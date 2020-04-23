function objToCypherString(obj) {
  let str = "";
  str = str + "{";
  Object.keys(obj).map((key) => {
    str = str + key + ":$" + key;
  });
  str = str + "}";
  return str;
}

module.exports = {
  objToCypherString,
};
