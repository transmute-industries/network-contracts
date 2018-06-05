module.exports.set = (db, key, value) => {
  return (db[key] = value);
};

module.exports.get = (db, key) => {
  return db[key];
};
