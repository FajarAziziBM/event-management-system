// tests/unit/order.service.test.js
'use strict';

/**
 * TEST-02: Unit test murni utk service layer — SELURUH model di-mock, tidak
 * ada koneksi database sungguhan sama sekali. Ini beda dgn tests/order.test.js
 * (integration, lewat HTTP + DB test asli) yang sudah ada — di sini fokusnya
 * memverifikasi LOGIKA (kalkulasi, validasi, error yang tepat) secara terisolasi
 * & cepat, termasuk cabang yang sulit dipicu lewat integration test biasa.
 */

const mockTransaction = jest.fn(async (callback) => {
  const t = { LOCK: { UPDATE: 'UPDATE' } };
  return callback(t);
});

jest.mock('../../src/models', () => ({
  sequelize: { transaction: (...args) => mockTransaction(...args) },
  Event: { findByPk: jest.fn() },
  Order: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  Payment: {},
  Ticket: {},
}));

const db = require('../../src/models');
const OrderService = require('../../src/services/order.service');
const { NotFoundError, ForbiddenError, ValidationError, ConflictError } = require('../../src/utils/errors');

/** Bikin fake instance Sequelize: object biasa + .update() yang mutasi in-memory. */
function fakeInstance(fields) {
  return {
    ...fields,
    update: jest.fn(async function (changes) {
      Object.assign(this, changes);
      return this;
    }),
  };
}

describe('OrderService (unit, model di-mock penuh)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
  });

  describe('createOrder — ORD-01/02/03/04', () => {
    function mockPublishedEvent(overrides = {}) {
      const event = fakeInstance({
        id: 1,
        status: 'published',
        ticketPrice: '100000.00',
        availableTicket: 10,
        eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ...overrides,
      });
      db.Event.findByPk.mockResolvedValue(event);
      return event;
    }

    it('ORD-03: menghitung subtotal, service fee (2%), dan total dengan benar', async () => {
      mockPublishedEvent({ ticketPrice: '100000.00', availableTicket: 10 });
      db.Order.findOne.mockResolvedValue(null); // order_number langsung unik di percobaan pertama
      db.Order.create.mockImplementation(async (fields) => fakeInstance(fields));

      const order = await OrderService.createOrder(42, { eventId: 1, quantity: 3 });

      // subtotal = 100000 * 3 = 300000; fee 2% = 6000; total = 306000
      expect(order.subtotal).toBe(300000);
      expect(order.serviceFee).toBe(6000);
      expect(order.totalAmount).toBe(306000);
    });

    it('ORD-02: order_number mengikuti format ORD-YYYYMMDD-XXXXXX', async () => {
      mockPublishedEvent();
      db.Order.findOne.mockResolvedValue(null);
      db.Order.create.mockImplementation(async (fields) => fakeInstance(fields));

      const order = await OrderService.createOrder(1, { eventId: 1, quantity: 1 });

      expect(order.orderNumber).toMatch(/^ORD-\d{8}-[A-Z0-9]{6}$/);
    });

    it('ORD-02: kalau kandidat order_number pertama sudah dipakai, coba lagi sampai unik', async () => {
      mockPublishedEvent();
      db.Order.findOne
        .mockResolvedValueOnce({ id: 999 }) // percobaan 1: bentrok
        .mockResolvedValueOnce({ id: 998 }) // percobaan 2: bentrok lagi
        .mockResolvedValueOnce(null); // percobaan 3: akhirnya unik
      db.Order.create.mockImplementation(async (fields) => fakeInstance(fields));

      await OrderService.createOrder(1, { eventId: 1, quantity: 1 });

      expect(db.Order.findOne).toHaveBeenCalledTimes(3);
    });

    it('ORD-04: kuota event dikurangi persis sejumlah quantity yang dipesan', async () => {
      const event = mockPublishedEvent({ availableTicket: 10 });
      db.Order.findOne.mockResolvedValue(null);
      db.Order.create.mockImplementation(async (fields) => fakeInstance(fields));

      await OrderService.createOrder(1, { eventId: 1, quantity: 4 });

      expect(event.update).toHaveBeenCalledWith(
        { availableTicket: 6 },
        expect.objectContaining({ transaction: expect.anything() }),
      );
    });

    it('menolak kalau quantity melebihi batas maksimum (10) per order', async () => {
      await expect(OrderService.createOrder(1, { eventId: 1, quantity: 11 })).rejects.toThrow(
        ValidationError,
      );
      // Harus gagal SEBELUM sempat buka transaksi/menyentuh DB sama sekali
      expect(db.Event.findByPk).not.toHaveBeenCalled();
    });

    it('menolak kalau event tidak ditemukan (NotFoundError)', async () => {
      db.Event.findByPk.mockResolvedValue(null);

      await expect(OrderService.createOrder(1, { eventId: 999, quantity: 1 })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('menolak kalau event belum/tidak published', async () => {
      mockPublishedEvent({ status: 'draft' });

      await expect(OrderService.createOrder(1, { eventId: 1, quantity: 1 })).rejects.toThrow(
        ValidationError,
      );
    });

    it('menolak kalau event sudah lewat tanggalnya', async () => {
      mockPublishedEvent({ eventDate: new Date(Date.now() - 24 * 60 * 60 * 1000) });

      await expect(OrderService.createOrder(1, { eventId: 1, quantity: 1 })).rejects.toThrow(
        ValidationError,
      );
    });

    it('menolak kalau kuota tersisa kurang dari quantity yang diminta', async () => {
      mockPublishedEvent({ availableTicket: 2 });

      await expect(OrderService.createOrder(1, { eventId: 1, quantity: 5 })).rejects.toThrow(
        ValidationError,
      );
      // Kuota TIDAK boleh berubah kalau order gagal dibuat
      const event = await db.Event.findByPk();
      expect(event.update).not.toHaveBeenCalled();
    });

    it('ORD-04: row lock (FOR UPDATE) dipakai saat membaca event, bukan plain read', async () => {
      mockPublishedEvent();
      db.Order.findOne.mockResolvedValue(null);
      db.Order.create.mockImplementation(async (fields) => fakeInstance(fields));

      await OrderService.createOrder(1, { eventId: 1, quantity: 1 });

      expect(db.Event.findByPk).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ lock: 'UPDATE' }),
      );
    });
  });

  describe('getOrderById — ORD-06 (otorisasi)', () => {
    it('melempar NotFoundError kalau order tidak ada', async () => {
      db.Order.findByPk.mockResolvedValue(null);
      await expect(OrderService.getOrderById(999, 1, 'customer')).rejects.toThrow(NotFoundError);
    });

    it('pemilik order boleh akses', async () => {
      db.Order.findByPk.mockResolvedValue(fakeInstance({ id: 1, userId: 42 }));
      await expect(OrderService.getOrderById(1, 42, 'customer')).resolves.toBeDefined();
    });

    it('BUKAN pemilik & bukan admin -> ForbiddenError', async () => {
      db.Order.findByPk.mockResolvedValue(fakeInstance({ id: 1, userId: 42 }));
      await expect(OrderService.getOrderById(1, 999, 'customer')).rejects.toThrow(ForbiddenError);
    });

    it('admin boleh akses order siapapun', async () => {
      db.Order.findByPk.mockResolvedValue(fakeInstance({ id: 1, userId: 42 }));
      await expect(OrderService.getOrderById(1, 1, 'admin')).resolves.toBeDefined();
    });
  });

  describe('cancelOrder — ORD-07', () => {
    it('order pending berhasil dibatalkan & kuota event dikembalikan', async () => {
      const order = fakeInstance({ id: 1, userId: 42, eventId: 7, quantity: 3, paymentStatus: 'pending' });
      const event = fakeInstance({ id: 7, availableTicket: 5 });
      db.Order.findByPk.mockResolvedValue(order);
      db.Event.findByPk.mockResolvedValue(event);

      await OrderService.cancelOrder(1, 42, 'customer');

      expect(event.update).toHaveBeenCalledWith(
        { availableTicket: 8 },
        expect.anything(),
      );
      expect(order.update).toHaveBeenCalledWith({ paymentStatus: 'cancelled' }, expect.anything());
    });

    it('order yang SUDAH paid tidak boleh dibatalkan (ConflictError)', async () => {
      const order = fakeInstance({ id: 1, userId: 42, eventId: 7, quantity: 1, paymentStatus: 'paid' });
      db.Order.findByPk.mockResolvedValue(order);

      await expect(OrderService.cancelOrder(1, 42, 'customer')).rejects.toThrow(ConflictError);
      expect(order.update).not.toHaveBeenCalled();
    });

    it('BUKAN pemilik ditolak (ForbiddenError), kuota tidak berubah', async () => {
      const order = fakeInstance({ id: 1, userId: 42, eventId: 7, quantity: 1, paymentStatus: 'pending' });
      db.Order.findByPk.mockResolvedValue(order);

      await expect(OrderService.cancelOrder(1, 999, 'customer')).rejects.toThrow(ForbiddenError);
      expect(db.Event.findByPk).not.toHaveBeenCalled();
    });

    it('kalau event terkait sudah terhapus, order tetap bisa dibatalkan (tanpa error)', async () => {
      const order = fakeInstance({ id: 1, userId: 42, eventId: 7, quantity: 1, paymentStatus: 'pending' });
      db.Order.findByPk.mockResolvedValue(order);
      db.Event.findByPk.mockResolvedValue(null); // event sudah dihapus

      await expect(OrderService.cancelOrder(1, 42, 'customer')).resolves.toBeDefined();
      expect(order.update).toHaveBeenCalledWith({ paymentStatus: 'cancelled' }, expect.anything());
    });
  });

  describe('listMyOrders — ORD-05 (pagination)', () => {
    it('menghitung totalPages pembulatan ke atas dgn benar', async () => {
      db.Order.findAndCountAll.mockResolvedValue({ count: 25, rows: [] });

      const result = await OrderService.listMyOrders(1, { page: 2, limit: 10 });

      expect(result.pagination).toEqual({ page: 2, limit: 10, totalItems: 25, totalPages: 3 });
      expect(db.Order.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 10 }),
      );
    });

    it('limit di-cap maksimum 100 walau diminta lebih besar', async () => {
      db.Order.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      const result = await OrderService.listMyOrders(1, { limit: 500 });
      expect(result.pagination.limit).toBe(100);
    });

    it('page negatif/0 dipaksa minimal 1', async () => {
      db.Order.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      const result = await OrderService.listMyOrders(1, { page: -5 });
      expect(result.pagination.page).toBe(1);
    });
  });

  describe('expirePendingOrders — ORD-08 (job)', () => {
    it('order pending yang lewat expiredAt di-expire & kuota dikembalikan', async () => {
      const order1 = fakeInstance({ id: 1, eventId: 10, quantity: 2, paymentStatus: 'pending' });
      const order2 = fakeInstance({ id: 2, eventId: 10, quantity: 1, paymentStatus: 'pending' });
      db.Order.findAll.mockResolvedValue([order1, order2]);
      const event = fakeInstance({ id: 10, availableTicket: 3 });
      db.Event.findByPk.mockResolvedValue(event);

      const result = await OrderService.expirePendingOrders();

      expect(result.expiredCount).toBe(2);
      expect(order1.update).toHaveBeenCalledWith({ paymentStatus: 'expired' }, expect.anything());
      expect(order2.update).toHaveBeenCalledWith({ paymentStatus: 'expired' }, expect.anything());
      // Kuota dikembalikan bertahap: +2 lalu +1 dari availableTicket awal 3 -> 5 -> 6
      expect(event.availableTicket).toBe(6);
    });

    it('tidak ada kandidat -> expiredCount 0, tidak ada transaksi dibuka', async () => {
      db.Order.findAll.mockResolvedValue([]);
      const result = await OrderService.expirePendingOrders();
      expect(result.expiredCount).toBe(0);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });
});
