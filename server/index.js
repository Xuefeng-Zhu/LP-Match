require('dotenv').config();

const express = require('express');
const { providers, Contract, Wallet } = require('ethers');
const { abi: IUniswapV2PairABI } = require('./IUniswapV2Pair.json');

const app = express();
const port = 3000;

const SECOND = 1000;

let wallet = new Wallet(process.env.PRIVATE_KEY);
const provider = new providers.InfuraProvider(
  process.env.NETWORK || 'kovan',
  process.env.INFURA_TOKEN
);

const pair = new Contract(process.env.UNI_PAIR, IUniswapV2PairABI, provider);

let priceCumulativeLast;
let blockTimestampLast;
let priceAverage;

async function updatePrice() {
  const priceCumulative = await pair.price1CumulativeLast();
  const reserves = await pair.getReserves();

  if (priceCumulativeLast && reserves.blockTimestampLast > blockTimestampLast) {
    priceAverage = priceCumulative
      .sub(priceCumulativeLast)
      .div(reserves.blockTimestampLast - blockTimestampLast)
      .div(ethers.BigNumber.from(2).pow(112));
  } else {
    priceAverage = reserves.reserve0.div(reserves.reserve1);
  }

  console.log('priceAverage', priceAverage.toString());

  priceCumulativeLast = priceCumulative;
  blockTimestampLast = reserves.blockTimestampLast;
}

app.get('/currentPrice', async (req, res) => {
  const sig = await wallet.signMessage(priceAverage);

  res.json({
    sig,
    priceAverage: priceAverage.toString(),
  });
});

app.listen(port, () => {
  setInterval(updatePrice, 60 * SECOND);
  console.log(`App listening on port ${port}`);
});
