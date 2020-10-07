/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

const expect = require('chai').expect;
const axios = require('axios');
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI);
const stockSchema = new mongoose.Schema(
  {
    stock: String,
    ips: [String],
    likes: Number
  }
);
const Stock = mongoose.model('Stock', stockSchema);

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get((req, res) => {

      const firstStock = axios.get(
        process.env.API_BASE + 
        Array.isArray(req.query.stock) ? req.query.stock[0] : req.query.stock +
        '/quote'
      );
      const secondStock = axios.get(
        process.env.API_BASE + 
        req.query.stock[1] + 
        '/quote'
      );

      axios.all([firstStock, secondStock])
      .then(axios.spread((...responses) => {
        const responseOne = responses[0];
        const responseTwo = responses[1];
      
        if(Array.isArray(req.query.stock)) {
          Stock.find({stock: {$in: req.query.stock}}, (error, data) => {
            if(error) console.log(error);

            res.json({
              stockData: [
                {
                  stock: responseOne.data.symbol,
                  price: responseOne.data.latestPrice,
                  likes: data[0].likes - data[1].likes
                },
                {
                  stock: responseTwo.data.symbol,
                  price: responseTwo.data.latestPrice,
                  likes: data[1].likes - data[0].likes
                }
              ]
            });
          });

          return;
        }

        let likeProcess = req.query.like || false;
        let ip = req.headers['x-forwarded-for'] || 
                        req.connection.remoteAddress || 
                        req.socket.remoteAddress;
        
        Stock.findOneAndUpdate(
          {stock: req.query.stock}, 
          {stock: req.query.stock},
          { upsert: true, ips:[], new: true }, 
          (error, result) => {
            if (error) return;

            if(likeProcess && !result.ips.includes(ip)) {
              let likes = result.likes || 0;
              Stock.findByIdAndUpdate(
                result._id,
                {
                  $push: { ips: ip }, 
                  likes: likes + 1
                },
                (error, data) => {
                  if (error) console.log(error);

                  res.json({
                    stockData: {
                      stock: responseOne.data.symbol,
                      price: responseOne.data.latestPrice,
                      likes: (data.likes + 1) || (likes + 1)
                    }
                  });
                }
              );

              return;
            }
          
            res.json({
              stockData: {
                stock: responseOne.data.symbol,
                price: responseOne.data.latestPrice,
                likes: result.likes || 0
              }
            });
        });
      }))
      .catch(errors => {
        console.log(errors.code);
      });
    });
};
