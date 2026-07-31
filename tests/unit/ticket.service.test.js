// tests/unit/ticket.service.test.js
'use strict';

/**
 * TEST-02: Unit test murni TicketService — model & util QR/signature di-mock
 * sebagian (signature tetap pakai implementasi ASLI supaya verifikasi
 * tampered-QR benar-benar teruji, bukan cuma dipalsukan lewat mock).
 */

const mockTransaction = jest.fn(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));

jest.mock('../../src/models', () => ({
  sequelize: { transaction: (...args) => mockTransaction(...args) },
  Ticket: { findByPk: jest.fn(), findOne: jest.fn() },
  Event: { findByPk: jest.fn() },
  Order: { findByPk: jest.fn() },
}));
jest.mock('../../src/utils/generateQrCodeImage', () => ({
  generateQrCodeDataUrl: jest.fn(async () => 'data:image/png;base64,FAKEQRDATA=='),
  generateQrCodeBuffer: jest.fn(async () => Buffer.from('fake-qr-bytes')),
}));

const db = require('../../src/models');
const { generateQrCodeDataUrl } = require('../../src/utils/generateQrCodeImage');
const { signQrPayload } = require('../../src/utils/signQrPayload');
const TicketService = require('../../src/services/ticket.service');
const { NotFoundError, ForbiddenError, ValidationError, ConflictError } = require('../../src/utils/errors');

function fakeInstance(fields) {
  return {
    ...fields,
    toJSON() {
      const { toJSON: _toJSON, update: _update, ...rest } = this;
      return rest;
    },
    update: jest.fn(async function (changes) {
      Object.assign(this, changes);
      return this;
    }),
  };
}

describe('TicketService (unit, model di-mock penuh, signature ASLI)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
  });

  describe('getTicketById — TIX-03 (otorisasi & QR)', () => {
    function mockTicket({ orderUserId = 42, eventCreatorId = 7 } = {}) {
      const ticket = fakeInstance({
        id: 1,
        ticketCode: 'TIX-000001-ABCDEFGH',
        qrCode: 'TIX-000001-ABCDEFGH.somesignature',
        order: { userId: orderUserId },
        event: { creatorId: eventCreatorId },
      });
      db.Ticket.findByPk.mockResolvedValue(ticket);
      return ticket;
    }

    it('mengembalikan data tiket + qrCodeImage (data URL)', async () => {
      mockTicket();
      const result = await TicketService.getTicketById(1, 42, 'customer');

      expect(result.qrCodeImage).toBe('data:image/png;base64,FAKEQRDATA==');
      expect(result.ticketCode).toBe('TIX-000001-ABCDEFGH');
      expect(generateQrCodeDataUrl).toHaveBeenCalledWith('TIX-000001-ABCDEFGH.somesignature');
    });

    it('pemilik order (customer) boleh akses', async () => {
      mockTicket({ orderUserId: 42 });
      await expect(TicketService.getTicketById(1, 42, 'customer')).resolves.toBeDefined();
    });

    it('organizer pemilik event terkait boleh akses', async () => {
      mockTicket({ orderUserId: 42, eventCreatorId: 7 });
      await expect(TicketService.getTicketById(1, 7, 'organizer')).resolves.toBeDefined();
    });

    it('admin selalu boleh akses', async () => {
      mockTicket({ orderUserId: 42, eventCreatorId: 7 });
      await expect(TicketService.getTicketById(1, 999, 'admin')).resolves.toBeDefined();
    });

    it('BUKAN pemilik & BUKAN organizer terkait -> ForbiddenError', async () => {
      mockTicket({ orderUserId: 42, eventCreatorId: 7 });
      await expect(TicketService.getTicketById(1, 555, 'customer')).rejects.toThrow(ForbiddenError);
    });

    it('tiket tidak ditemukan -> NotFoundError', async () => {
      db.Ticket.findByPk.mockResolvedValue(null);
      await expect(TicketService.getTicketById(999, 42, 'customer')).rejects.toThrow(NotFoundError);
    });
  });

  describe('scanTicket — TIX-05/06/07', () => {
    function setupValidTicket({ eventCreatorId = 7, orderStatus = 'paid', isCheckedIn = false } = {}) {
      const ticketCode = 'TIX-000042-QRSTUV12';
      const validQr = signQrPayload(ticketCode); // signature ASLI, bukan mock
      const ticket = fakeInstance({ id: 1, eventId: 5, orderId: 9, ticketCode, isCheckedIn, checkedInAt: null });
      db.Ticket.findOne.mockResolvedValue(ticket);
      db.Event.findByPk.mockResolvedValue({ id: 5, creatorId: eventCreatorId, title: 'Event Scan' });
      db.Order.findByPk.mockResolvedValue({ id: 9, paymentStatus: orderStatus });
      return { ticket, validQr, ticketCode };
    }

    it('scan payload penuh (ticket_code.signature) yang valid -> berhasil check-in', async () => {
      const { ticket, validQr } = setupValidTicket({ eventCreatorId: 7 });
      const result = await TicketService.scanTicket(validQr, 7, 'organizer');

      expect(ticket.isCheckedIn).toBe(true);
      expect(ticket.checkedInAt).toBeInstanceOf(Date);
      expect(result.ticket).toBe(ticket);
    });

    it('fallback: scan ticket_code polos (tanpa signature) tetap berhasil', async () => {
      const { ticket, ticketCode } = setupValidTicket({ eventCreatorId: 7 });
      await TicketService.scanTicket(ticketCode, 7, 'organizer');
      expect(ticket.isCheckedIn).toBe(true);
    });

    it('TIX-06: signature dipalsukan/diedit -> ValidationError, TIDAK check-in', async () => {
      const { ticket, ticketCode } = setupValidTicket({ eventCreatorId: 7 });
      const tampered = `${ticketCode}.signature-yang-dipalsukan`;

      await expect(TicketService.scanTicket(tampered, 7, 'organizer')).rejects.toThrow(ValidationError);
      expect(ticket.isCheckedIn).toBe(false);
    });

    it('TIX-06: organizer BUKAN pemilik event -> ForbiddenError, TIDAK check-in', async () => {
      const { ticket, validQr } = setupValidTicket({ eventCreatorId: 7 });
      await expect(TicketService.scanTicket(validQr, 999, 'organizer')).rejects.toThrow(ForbiddenError);
      expect(ticket.isCheckedIn).toBe(false);
    });

    it('admin boleh scan tiket event siapapun', async () => {
      const { ticket, validQr } = setupValidTicket({ eventCreatorId: 7 });
      await TicketService.scanTicket(validQr, 999, 'admin');
      expect(ticket.isCheckedIn).toBe(true);
    });

    it('order terkait belum/tidak paid -> ValidationError (defensif)', async () => {
      const { validQr } = setupValidTicket({ eventCreatorId: 7, orderStatus: 'pending' });
      await expect(TicketService.scanTicket(validQr, 7, 'organizer')).rejects.toThrow(ValidationError);
    });

    it('TIX-07: sudah check-in sebelumnya -> ConflictError dgn waktu check-in di detail', async () => {
      const checkedInAt = new Date('2026-01-01T10:00:00.000Z');
      const { validQr } = setupValidTicket({ eventCreatorId: 7, isCheckedIn: true });
      db.Ticket.findOne.mockResolvedValue(
        fakeInstance({ id: 1, eventId: 5, orderId: 9, ticketCode: 'TIX-000042-QRSTUV12', isCheckedIn: true, checkedInAt }),
      );

      await expect(TicketService.scanTicket(validQr, 7, 'organizer')).rejects.toThrow(ConflictError);
    });

    it('tiket tidak ditemukan -> NotFoundError', async () => {
      db.Ticket.findOne.mockResolvedValue(null);
      await expect(TicketService.scanTicket('TIX-TIDAKADA-XXXXXXXX', 7, 'organizer')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('payload kosong/bukan string -> ValidationError sebelum menyentuh DB', async () => {
      await expect(TicketService.scanTicket('', 7, 'organizer')).rejects.toThrow(ValidationError);
      await expect(TicketService.scanTicket(null, 7, 'organizer')).rejects.toThrow(ValidationError);
      expect(db.Ticket.findOne).not.toHaveBeenCalled();
    });
  });
});
