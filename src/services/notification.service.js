// services/notification.service.js

'use strict';

const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({

  host: process.env.MAIL_HOST,

  port: process.env.MAIL_PORT,

  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  }

});


class NotificationService {


  static async sendResetPasswordEmail(
    email,
    token
  ) {

    const url =
      `${process.env.APP_URL}/reset-password?token=${token}`;


    await transporter.sendMail({

      from:
        process.env.MAIL_FROM_ADDRESS,

      to: email,

      subject:
        'Reset Password',

      html:
        `
      <h3>Password Reset</h3>

      <p>
      Klik link berikut:
      </p>

      <a href="${url}">
      Reset Password
      </a>
      `

    });

  }


}


module.exports = NotificationService;

