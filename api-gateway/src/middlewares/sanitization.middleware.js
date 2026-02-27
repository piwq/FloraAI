import xss from 'xss';

const sanitize = (data) => {
  if (typeof data === 'string') {
    return xss(data);
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitize(item));
  }
  if (typeof data === 'object' && data !== null) {
    const sanitizedObject = {};
    for (const key in data) {
      sanitizedObject[key] = sanitize(data[key]);
    }
    return sanitizedObject;
  }
  return data;
};

export const sanitizeInput = (req, res, next) => {
  if (req.body) {
    req.body = sanitize(req.body);
  }

  if (req.params) {
    for (const key in req.params) {
      req.params[key] = sanitize(req.params[key]);
    }
  }
  if (req.query) {
    for (const key in req.query) {
      req.query[key] = sanitize(req.query[key]);
    }
  }

  next();
};