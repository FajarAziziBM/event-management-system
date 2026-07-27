// src/controllers/web/order.controller.js
'use strict';

const EventService = require('../../services/event.service');
const OrderService = require('../../services/order.service');
const PaymentService = require('../../services/payment.service');
const db = require('../../models');
const config = require('../../config/env');
const { setFlash } = require('../../utils/flash');

function friendlyMessage(err) {
  return err.message || 'Terjadi kesalahan, silakan coba lagi.';
}

const OrderWebController = {
  /** GET /events/:slug/checkout?qty=N — halaman konfirmasi sebelum bayar */
  async checkoutForm(req, res, next) {
    try {
      const event = await EventService.getEventBySlug(req.params.slug, req.user);
      const quantity = Math.min(Math.max(parseInt(req.query.qty, 10) || 1, 1), event.availableTicket || 1);

      if (event.status !== 'published') {
        setFlash(res, 'error', 'Event ini sedang tidak menerima pemesanan.');
        return res.redirect(`/events/${event.slug}`);
      }
      if (event.availableTicket < 1) {
        setFlash(res, 'error', 'Maaf, tiket untuk event ini sudah habis.');
        return res.redirect(`/events/${event.slug}`);
      }

      const subtotal = parseFloat(event.ticketPrice) * quantity;
      const serviceFee = Math.round(subtotal * (config.order.serviceFeePercentage / 100));
      const totalAmount = subtotal + serviceFee;

      res.render('orders/checkout', {
        title: 'Checkout',
        event,
        quantity,
        subtotal,
        serviceFee,
        totalAmount,
        serviceFeePercentage: config.order.serviceFeePercentage,
        expiryMinutes: config.order.expiryMinutes,
        errors: {},
      });
    } catch (err) {
      next(err);
    }
  },

  /** POST /orders — buat order lalu redirect ke halaman pembayaran Xendit */
  async create(req, res, next) {
    const eventId = req.body.eventId;
    const quantity = Math.max(parseInt(req.body.quantity, 10) || 1, 1);

    try {
      if (!req.body.agree) {
        const event = await db.Event.findByPk(eventId);
        setFlash(res, 'error', 'Anda harus menyetujui syarat & ketentuan terlebih dahulu.');
        return res.redirect(`/events/${event ? event.slug : ''}/checkout?qty=${quantity}`);
      }

      const order = await OrderService.createOrder(req.user.id, { eventId, quantity });
      const payment = await PaymentService.createInvoiceForOrder(order.id);

      return res.redirect(payment.paymentUrl);
    } catch (err) {
      try {
        const event = await db.Event.findByPk(eventId);
        setFlash(res, 'error', friendlyMessage(err));
        return res.redirect(`/events/${event ? event.slug : ''}/checkout?qty=${quantity}`);
      } catch (innerErr) {
        return next(innerErr);
      }
    }
  },

  /** GET /orders — riwayat pesanan milik user yang login */
  async myOrders(req, res, next) {
    try {
      const { orders, pagination } = await OrderService.listMyOrders(req.user.id, {
        page: req.query.page || 1,
      });
      res.render('orders/my-orders', { title: 'Pesanan Saya', orders, pagination });
    } catch (err) {
      next(err);
    }
  },

  /** GET /orders/:id — detail satu pesanan */
  async detail(req, res, next) {
    try {
      const order = await OrderService.getOrderById(req.params.id, req.user.id, req.user.role);
      let paymentUrl = null;
      if (order.paymentStatus === 'pending') {
        const result = await PaymentService.getPaymentUrl(order.id, req.user.id, req.user.role).catch(
          () => null,
        );
        paymentUrl = result ? result.paymentUrl : null;
      }
      res.render('orders/detail', { title: `Pesanan ${order.orderNumber}`, order, paymentUrl });
    } catch (err) {
      next(err);
    }
  },

  /** GET /orders/:id/status — JSON ringan untuk polling status pembayaran */
  async statusJson(req, res, next) {
    try {
      const status = await PaymentService.getPaymentStatus(req.params.id, req.user.id, req.user.role);
      res.json(status);
    } catch (err) {
      next(err);
    }
  },

  /** POST /orders/:id/cancel */
  async cancel(req, res, next) {
    try {
      await OrderService.cancelOrder(req.params.id, req.user.id, req.user.role);
      setFlash(res, 'success', 'Pesanan berhasil dibatalkan.');
    } catch (err) {
      setFlash(res, 'error', friendlyMessage(err));
    }
    res.redirect('/orders');
  },

  /**
   * GET /orders/success — halaman redirect balik dari Xendit setelah bayar.
   * Xendit tidak menyertakan order id spesifik di success_redirect_url (URL-nya statis),
   * jadi di sini kita tampilkan pesanan PAID milik user ini yang paling baru diubah.
   */
  async success(req, res, next) {
    try {
      const { orders } = await OrderService.listMyOrders(req.user.id, { limit: 1 });
      const order =
        orders[0] && orders[0].paymentStatus === 'paid'
          ? await OrderService.getOrderById(orders[0].id, req.user.id, req.user.role)
          : null;
      res.render('orders/success', { title: 'Pembayaran Berhasil', order });
    } catch (err) {
      next(err);
    }
  },

  /** GET /orders/failed — halaman redirect balik dari Xendit setelah gagal/batal bayar */
  async failed(req, res, next) {
    try {
      const { orders } = await OrderService.listMyOrders(req.user.id, { limit: 1 });
      const order = orders[0] || null;
      res.render('orders/failed', { title: 'Pembayaran Gagal', order });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = OrderWebController;
