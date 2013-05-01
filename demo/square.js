module.exports = Square;

function Square(w) {
  this.w = w;
}

Square.prototype.area = function () {
  return this.w * this.w;
};

Square.prototype.perimeter = function () {
  return this.w * 4;
};
