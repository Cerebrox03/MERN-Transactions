const express = require("express");
const axios = require("axios");
const Transaction = require("../models/Transaction");
const router = express.Router();

const API_URL = "https://s3.amazonaws.com/roxiler.com/product_transaction.json";

// Fetch data and store in database
router.get("/initialize", async (req, res) => {
  try {
    const response = await axios.get(API_URL);
    await Transaction.deleteMany(); // Clear old data
    await Transaction.insertMany(response.data);
    res.status(200).json({ message: "Database initialized with seed data" });
  } catch (error) {
    res.status(500).json({ error: "Error fetching or storing data" });
  }
});

module.exports = router;
router.get("/transactions", async (req, res) => {
  const { month, search = "", page = 1, perPage = 10 } = req.query;

  const startDate = new Date(`${month} 1, 2000`).getMonth() + 1;
  const transactions = await Transaction.find({
    dateOfSale: { $regex: `-${startDate}-`, $options: "i" },
    $or: [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { price: search ? parseFloat(search) || 0 : { $exists: true } },
    ],
  })
    .skip((page - 1) * perPage)
    .limit(perPage);

  res.json(transactions);
});

router.get("/statistics", async (req, res) => {
  const { month } = req.query;
  const startDate = new Date(`${month} 1, 2000`).getMonth() + 1;

  const totalSales = await Transaction.aggregate([
    { $match: { dateOfSale: { $regex: `-${startDate}-`, $options: "i" } } },
    { $group: { _id: null, totalAmount: { $sum: "$price" }, soldItems: { $sum: { $cond: ["$sold", 1, 0] } } } }
  ]);

  const totalNotSold = await Transaction.countDocuments({
    dateOfSale: { $regex: `-${startDate}-`, $options: "i" },
    sold: false,
  });

  res.json({ 
    totalAmount: totalSales[0]?.totalAmount || 0, 
    soldItems: totalSales[0]?.soldItems || 0, 
    notSoldItems: totalNotSold 
  });
});

router.get("/barchart", async (req, res) => {
  const { month } = req.query;
  const startDate = new Date(`${month} 1, 2000`).getMonth() + 1;

  const priceRanges = [
    { range: "0-100", min: 0, max: 100 },
    { range: "101-200", min: 101, max: 200 },
    { range: "201-300", min: 201, max: 300 },
    { range: "301-400", min: 301, max: 400 },
    { range: "401-500", min: 401, max: 500 },
    { range: "501-600", min: 501, max: 600 },
    { range: "601-700", min: 601, max: 700 },
    { range: "701-800", min: 701, max: 800 },
    { range: "801-900", min: 801, max: 900 },
    { range: "901-above", min: 901, max: Infinity }
  ];

  let result = {};
  for (const range of priceRanges) {
    result[range.range] = await Transaction.countDocuments({
      dateOfSale: { $regex: `-${startDate}-`, $options: "i" },
      price: { $gte: range.min, $lte: range.max },
    });
  }

  res.json(result);
});

router.get("/piechart", async (req, res) => {
  const { month } = req.query;
  const startDate = new Date(`${month} 1, 2000`).getMonth() + 1;

  const categoryStats = await Transaction.aggregate([
    { $match: { dateOfSale: { $regex: `-${startDate}-`, $options: "i" } } },
    { $group: { _id: "$category", count: { $sum: 1 } } }
  ]);

  res.json(categoryStats);
});

