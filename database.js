const mysql = require("mysql2");
const dotenv = require("dotenv").config();

const pool = mysql
  .createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,
  })
  .promise();

async function getAllCustomers() {
  const [rows] = await pool.query("select * from customer");
  return rows;
}

async function checkForDuplicates(phone, email) {
  let queryToCheck =
    "select * from customer where phoneNumber =? OR email=? order by createdAt DESC";
  let vairableArray = [];
  //handle null cases
  if (!phone) {
    queryToCheck =
      "select * from customer where email=? order by createdAt DESC";
    vairableArray.push(email);
  } else if (!email) {
    queryToCheck =
      "select * from customer where phoneNumber =? order by createdAt DESC";
    vairableArray.push(phone);
  } else {
    vairableArray.push(phone, email);
  }

  //querycall and result
  const [rows] = await pool.query(queryToCheck, vairableArray);

  // console.log("Query: ", queryToCheck);
  // console.log("Query Variables: ", vairableArray);
  return rows;
}

async function getCustomer(id) {
  const [rows] = await pool.query("select * from customer where id=?", [id]);
  return rows[0];
}

async function getSecondaryCustomers(id) {
  const [rows] = await pool.query(
    "select * from customer where linkedId=? or id =?",
    [id, id]
  );
  return rows;
}

async function createCustomer(data) {
  const [rows] = await pool.query(
    "insert into customer (phoneNumber,email,linkPrecedence,linkedId) values (?,?,?,?)",
    [data.phone, data.email, data.linkP, data.linkedId]
  );
  return await getCustomer(rows.insertId);
}

async function updateCustomer(linkP, linkedId, id) {
  const [rows] = await pool.query(
    "update customer set linkPrecedence =?,linkedId = ? where id=?",
    [linkP, linkedId, id]
  );
  return rows;
}

async function updateMissingValuesInCustomer(data) {
  const [rows] = await pool.query(
    "update customer set phoneNumber =?,email =? where id=?",
    [data.phone, data.email, data.id]
  );
  return rows;
}
// const run = async () => {
//   let data = {
//     phone: "1234111111",
//     email: "ball@gmail.com",
//     linkP: "primary",
//   };
//   const customers = await createCustomer(data);
//   console.log(customers);
// };

// run();

module.exports = {
  getAllCustomers,
  getCustomer,
  createCustomer,
  checkForDuplicates,
  getSecondaryCustomers,
  updateCustomer,
  updateMissingValuesInCustomer,
};
