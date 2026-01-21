const { Notification, shell } = require('electron');
const path = require('path');
const { getConfig } = require('../db/configDb');

const noticeTitle = 'Test';
function sendNotice(msg, url) {
  const config = getConfig();
  const reminder = config.global.notify.disable;

  if (reminder) {
    const notif = new Notification({
      icon: path.join(__dirname, '../../public/favicon.png'),
      title: noticeTitle,
      body: msg,

      sound: path.join(__dirname, '../../public/朴树+-+平凡之路.mp3'),
      silent: true, // 系统默认的通知声音
    });
    notif.on('click', () => {
      if (url) shell.openExternal(url);
    });

    notif.show();
  }
}

module.exports = { sendNotice };
