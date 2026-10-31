const config = require('../config');
const auth = require('../services/auth.service');
const { t } = require('../i18n');

module.exports = function requireAuth(req, res, next) {
  const sid = req.cookies && req.cookies.sid;
  const user = sid && auth.getSessionUser(sid);
  // BIND_SESSION_IP=1 ise oturum yalnızca giriş onaylanan IP'den geçerli
  if (!user || (config.bindSessionIp && user.session_ip && user.session_ip !== req.ip))
    return res.status(401).json({ error: t(req.lang, 'err.authRequired') });
  req.user = user;
  next();
};
