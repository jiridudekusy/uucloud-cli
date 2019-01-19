const parseRelativeDateTime = require("../src/misc/relative-date-parser");

function testRelativeDate(expr, refDateString, expDateString){
  let refDate = new Date(refDateString);
  let expDate;
  if(expDateString) {
    expDate = new Date(expDateString);
  }
  let resDate = parseRelativeDateTime(expr, refDate);
  expect(resDate).toEqual(expDate);
}

test("42m - overlap", () => {
  testRelativeDate("42m", "2019-01-01T00:30:00", "2018-12-31T23:48:00");
});

test("2h - overlap", () => {
  testRelativeDate("2h", "2019-01-01T00:30:00", "2018-12-31T22:30:00");
});

test("10080m", () => {
  testRelativeDate("10080m", "2019-01-01T00:30:00", "2018-12-25T00:30:00");
});

test("standard date", () => {
  testRelativeDate("2018-12-25T00:30:00", "2019-01-01T00:30:00", "2018-12-25T00:30:00");
});

test("invalid date", () => {
  testRelativeDate("ahoj", "2019-01-01T00:30:00");
});