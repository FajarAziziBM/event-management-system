// tests/unit/payment.service.test.js
'use strict';

/**
 * TEST-02: Unit test murni PaymentService — model, XenditService, dan
 * NotificationService semua di-mock. Fokus ke logika handleWebhook (termasuk
 * idempotency & cabang FAILED yang belum ada di integration test payment.test.js)
 * tanpa perlu database maupun jaringan sungguhan.
 */

const mockTransaction = jest.fn(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));

jest.mock('../../src/models', () => ({
  sequelize: { transaction: (...args) => mockTransaction(...args) },
  Order: { findByPk: jest.fn() },
  Event: { findByPk: jest.fn() },
  User: { findByPk: jest.fn() },
  Payment: { findOne: jest.fn(), create: jest.fn() },
  Ticket: { create: jest.fn() },
}));
jest.mock('../../src/services/xendit.service');
jest.mock('../../src/services/notification.service');

const db = require('../../src/models');
const XenditService = require('../../src/services/xendit.service');
const NotificationService = require('../../src/services/notification.service');
const PaymentService = require('../../src/services/payment.service');
const { NotFoundError, ForbiddenError, ConflictError } = require('../../src/utils/errors');

function fakeInstance(fields) {
  return {
    ...fields,
    update: jest.fn(async function (changes) {
      Object.assign(this, changes);
      return this;
    }),
  };
}

describe('PaymentService (unit, model/Xendit/notifikasi di-mock penuh)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
  });

  describe('createInvoiceForOrder — PAY-02/03', () => {
    it('memanggil XenditService dgn payload yg benar & menyimpan payment', async () => {
      const order = fakeInstance({
        id: 1,
        orderNumber: 'ORD-20260101-ABCDEF',
        totalAmount: '306000.00',
        event: { title: 'Konser Tes' },
        user: { email: 'andi@example.com' },
      });
      db.Order.findByPk.mockResolvedValue(order);
      XenditService.createInvoice.mockResolvedValue({
        id: 'inv-123',
        externalId: 'ORD-20260101-ABCDEF',
        invoiceUrl: 'https://checkout-mock.xendit.co/inv-123',
        expiryDate: new Date('2026-01-02'),
      });
      db.Payment.create.mockImplementation(async (fields) => fakeInstance(fields));

      const payment = await PaymentService.createInvoiceForOrder(1);

      expect(XenditService.createInvoice).toHaveBeenCalledWith({
        externalId: 'ORD-20260101-ABCDEF',
        amount: 306000,
        payerEmail: 'andi@example.com',
        description: 'Pembayaran tiket: Konser Tes',
      });
      expect(payment.invoiceId).toBe('inv-123');
      expect(payment.status).toBe('pending');
    });

    it('order tidak ditemukan -> NotFoundError, Xendit TIDAK dipanggil', async () => {
      db.Order.findByPk.mockResolvedValue(null);
      await expect(PaymentService.createInvoiceForOrder(999)).rejects.toThrow(NotFoundError);
      expect(XenditService.createInvoice).not.toHaveBeenCalled();
    });
  });

  describe('getPaymentUrl — PAY-04 (lazy retry & otorisasi)', () => {
    it('mengembalikan payment_url yang sudah ada tanpa panggil Xendit lagi', async () => {
      const order = fakeInstance({
        id: 1,
        userId: 42,
        paymentStatus: 'pending',
        payment: { paymentUrl: 'https://existing.url', expiredAt: new Date('2026-01-02') },
      });
      db.Order.findByPk.mockResolvedValue(order);

      const result = await PaymentService.getPaymentUrl(1, 42, 'customer');

      expect(result.paymentUrl).toBe('https://existing.url');
      expect(XenditService.createInvoice).not.toHaveBeenCalled();
    });

    it('lazy-retry: payment belum ada -> createInvoiceForOrder dipanggil', async () => {
      const orderNoPayment = fakeInstance({ id: 1, userId: 42, paymentStatus: 'pending', payment: null });
      const orderForInvoice = fakeInstance({
        id: 1,
        orderNumber: 'ORD-20260101-XXXXXX',
        totalAmount: '100000',
        event: { title: 'Event X' },
        user: { email: 'andi@example.com' },
      });
      db.Order.findByPk.mockResolvedValueOnce(orderNoPayment).mockResolvedValueOnce(orderForInvoice);
      XenditService.createInvoice.mockResolvedValue({
        id: 'inv-999',
        externalId: 'ORD-20260101-XXXXXX',
        invoiceUrl: 'https://new.url',
        expiryDate: new Date('2026-01-02'),
      });
      db.Payment.create.mockImplementation(async (fields) => fakeInstance(fields));

      const result = await PaymentService.getPaymentUrl(1, 42, 'customer');

      expect(result.paymentUrl).toBe('https://new.url');
      expect(XenditService.createInvoice).toHaveBeenCalledTimes(1);
    });

    it('order yang sudah paid -> ConflictError (tidak ada payment_url yg relevan lagi)', async () => {
      const order = fakeInstance({ id: 1, userId: 42, paymentStatus: 'paid', payment: null });
      db.Order.findByPk.mockResolvedValue(order);
      await expect(PaymentService.getPaymentUrl(1, 42, 'customer')).rejects.toThrow(ConflictError);
    });

    it('BUKAN pemilik -> ForbiddenError', async () => {
      const order = fakeInstance({ id: 1, userId: 42, paymentStatus: 'pending', payment: null });
      db.Order.findByPk.mockResolvedValue(order);
      await expect(PaymentService.getPaymentUrl(1, 999, 'customer')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('handleWebhook — PAY-05..09', () => {
    it('external_id tidak ditemukan -> handled:false, tidak melempar error', async () => {
      db.Payment.findOne.mockResolvedValue(null);
      const result = await PaymentService.handleWebhook({ external_id: 'ORD-TIDAK-ADA', status: 'PAID' });
      expect(result).toEqual({ handled: false, reason: 'payment_not_found' });
    });

    it('status yang bukan final (mis. PENDING) diabaikan tanpa efek samping', async () => {
      const payment = fakeInstance({ id: 1, orderId: 1, status: 'pending' });
      db.Payment.findOne.mockResolvedValue(payment);

      const result = await PaymentService.handleWebhook({ external_id: 'ORD-X', status: 'PENDING' });

      expect(result).toEqual({ handled: true, ignored: true, status: 'PENDING' });
      expect(payment.update).not.toHaveBeenCalled();
    });

    describe('PAY-09: idempotency', () => {
      it.each(['paid', 'expired', 'failed'])(
        'payment yg statusnya SUDAH final (%s) -> alreadyProcessed, tidak diproses ulang',
        async (finalStatus) => {
          const payment = fakeInstance({ id: 1, orderId: 1, status: finalStatus });
          db.Payment.findOne.mockResolvedValue(payment);

          const result = await PaymentService.handleWebhook({ external_id: 'ORD-X', status: 'PAID' });

          expect(result).toEqual({ handled: true, alreadyProcessed: true });
          expect(payment.update).not.toHaveBeenCalled();
          expect(db.Order.findByPk).not.toHaveBeenCalled();
        },
      );
    });

    describe('PAY-07: status PAID/SETTLED', () => {
      function setupPaidScenario({ quantity = 2 } = {}) {
        const payment = fakeInstance({ id: 1, orderId: 10, status: 'pending' });
        const order = fakeInstance({
          id: 10,
          orderNumber: 'ORD-20260101-AAAAAA',
          userId: 42,
          quantity,
          totalAmount: 200000,
          paymentStatus: 'pending',
          event: { title: 'Event Bayar' },
          user: { id: 42, name: 'Andi', email: 'andi@example.com', phone: '0811' },
        });
        db.Payment.findOne.mockResolvedValue(payment);
        db.Order.findByPk.mockResolvedValue(order);
        db.User.findByPk.mockResolvedValue({ id: 42, name: 'Andi', email: 'andi@example.com', phone: '0811' });
        db.Ticket.create.mockImplementation(async (fields) => fakeInstance(fields));
        return { payment, order };
      }

      it.each(['PAID', 'SETTLED'])('status %s -> payment & order jadi paid, tiket sejumlah quantity', async (status) => {
        const { payment, order } = setupPaidScenario({ quantity: 3 });

        const result = await PaymentService.handleWebhook({
          external_id: order.orderNumber,
          status,
          payment_method: 'VIRTUAL_ACCOUNT',
          paid_at: '2026-01-01T10:00:00.000Z',
        });

        expect(payment.status).toBe('paid');
        expect(order.paymentStatus).toBe('paid');
        expect(order.paymentMethod).toBe('VIRTUAL_ACCOUNT');
        expect(db.Ticket.create).toHaveBeenCalledTimes(3);
        expect(result.ticketsGenerated).toBe(3);
      });

      it('setiap tiket dapat ticket_code unik & qr_code yang memuat ticket_code-nya', async () => {
        setupPaidScenario({ quantity: 2 });
        await PaymentService.handleWebhook({ external_id: 'ORD-20260101-AAAAAA', status: 'PAID' });

        const calls = db.Ticket.create.mock.calls.map((c) => c[0]);
        expect(calls).toHaveLength(2);
        expect(calls[0].ticketCode).not.toBe(calls[1].ticketCode);
        calls.forEach((fields) => {
          expect(fields.qrCode).toContain(fields.ticketCode);
          expect(fields.attendeeEmail).toBe('andi@example.com');
        });
      });

      it('mengirim notifikasi sukses SETELAH transaksi (bukan di dalamnya)', async () => {
        const { order } = setupPaidScenario();
        const callOrder = [];
        db.Ticket.create.mockImplementation(async (fields) => {
          callOrder.push('ticket.create');
          return fakeInstance(fields);
        });
        NotificationService.sendPaymentSuccess.mockImplementation(async () => {
          callOrder.push('notify');
        });

        await PaymentService.handleWebhook({ external_id: order.orderNumber, status: 'PAID' });

        expect(NotificationService.sendPaymentSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'andi@example.com', orderId: 10 }),
        );
        expect(callOrder.indexOf('notify')).toBeGreaterThan(callOrder.indexOf('ticket.create'));
      });

      it('paid_at pakai waktu sekarang kalau Xendit tidak mengirim field itu', async () => {
        const { payment } = setupPaidScenario();
        const before = Date.now();
        await PaymentService.handleWebhook({ external_id: 'ORD-20260101-AAAAAA', status: 'PAID' });
        expect(payment.paidAt.getTime()).toBeGreaterThanOrEqual(before);
      });
    });

    describe('PAY-08: status EXPIRED', () => {
      it('order jadi expired, kuota event dikembalikan, TIDAK generate tiket', async () => {
        const payment = fakeInstance({ id: 1, orderId: 10, status: 'pending' });
        const order = fakeInstance({
          id: 10,
          orderNumber: 'ORD-X',
          eventId: 99,
          quantity: 4,
          paymentStatus: 'pending',
          event: { title: 'Event Expired' },
          user: { email: 'andi@example.com', name: 'Andi' },
        });
        const event = fakeInstance({ id: 99, availableTicket: 6 });
        db.Payment.findOne.mockResolvedValue(payment);
        db.Order.findByPk.mockResolvedValue(order);
        db.Event.findByPk.mockResolvedValue(event);

        const result = await PaymentService.handleWebhook({ external_id: 'ORD-X', status: 'EXPIRED' });

        expect(payment.status).toBe('expired');
        expect(order.paymentStatus).toBe('expired');
        expect(event.availableTicket).toBe(10); // 6 + 4 dikembalikan
        expect(db.Ticket.create).not.toHaveBeenCalled();
        expect(result.status).toBe('expired');
      });

      it('kalau order SUDAH bukan pending (mis. sudah dibatalkan manual), kuota tidak disentuh dua kali', async () => {
        const payment = fakeInstance({ id: 1, orderId: 10, status: 'pending' });
        const order = fakeInstance({
          id: 10,
          orderNumber: 'ORD-X',
          eventId: 99,
          quantity: 4,
          paymentStatus: 'cancelled', // sudah dibatalkan user, kuota SUDAH dikembalikan sebelumnya
          event: { title: 'Event' },
          user: { email: 'andi@example.com', name: 'Andi' },
        });
        db.Payment.findOne.mockResolvedValue(payment);
        db.Order.findByPk.mockResolvedValue(order);

        await PaymentService.handleWebhook({ external_id: 'ORD-X', status: 'EXPIRED' });

        expect(db.Event.findByPk).not.toHaveBeenCalled(); // tidak menyentuh event sama sekali
      });
    });

    describe('PAY-09 (skenario ke-3, sesuai komentar kode): status FAILED', () => {
      it('diperlakukan spt expired di level data, TAPI payments.status = "failed" (bukan "expired")', async () => {
        const payment = fakeInstance({ id: 1, orderId: 10, status: 'pending' });
        const order = fakeInstance({
          id: 10,
          orderNumber: 'ORD-X',
          eventId: 99,
          quantity: 2,
          paymentStatus: 'pending',
          event: { title: 'Event Failed' },
          user: { email: 'andi@example.com', name: 'Andi' },
        });
        const event = fakeInstance({ id: 99, availableTicket: 3 });
        db.Payment.findOne.mockResolvedValue(payment);
        db.Order.findByPk.mockResolvedValue(order);
        db.Event.findByPk.mockResolvedValue(event);

        const result = await PaymentService.handleWebhook({ external_id: 'ORD-X', status: 'FAILED' });

        expect(payment.status).toBe('failed'); // presisi beda dari order
        expect(order.paymentStatus).toBe('expired'); // enum order memang tidak punya 'failed'
        expect(event.availableTicket).toBe(5);
        expect(result.status).toBe('failed');
        expect(NotificationService.sendPaymentFailed).toHaveBeenCalled();
      });
    });
  });

  describe('getPaymentStatus — PAY-10', () => {
    it('menggabungkan status order & payment dengan benar', async () => {
      const order = fakeInstance({
        id: 1,
        userId: 42,
        orderNumber: 'ORD-X',
        paymentStatus: 'paid',
        paidAt: new Date('2026-01-01'),
        payment: { status: 'paid' },
      });
      db.Order.findByPk.mockResolvedValue(order);

      const result = await PaymentService.getPaymentStatus(1, 42, 'customer');

      expect(result).toEqual({
        orderId: 1,
        orderNumber: 'ORD-X',
        orderStatus: 'paid',
        paymentStatus: 'paid',
        paidAt: order.paidAt,
      });
    });

    it('payment belum ada -> paymentStatus null (bukan error)', async () => {
      const order = fakeInstance({ id: 1, userId: 42, orderNumber: 'ORD-X', paymentStatus: 'pending', paidAt: null, payment: null });
      db.Order.findByPk.mockResolvedValue(order);
      const result = await PaymentService.getPaymentStatus(1, 42, 'customer');
      expect(result.paymentStatus).toBeNull();
    });
  });
});
