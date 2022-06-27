require('dotenv').config();

const express = require('express');
const { providers, Contract, Wallet, utils, BigNumber } = require('ethers');
const { abi: IUniswapV2PairABI } = require('./IUniswapV2Pair.json');
const { toUtf8Bytes } = require('@ethersproject/strings');
const { hashMessage } = require('@ethersproject/hash');

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
      .div(reserves.blockTimestampLast - blockTimestampLast);
  } else {
    priceAverage = reserves.reserve0
      .div(reserves.reserve1)
      .mul(BigNumber.from(2).pow(112));
  }

  console.log('priceAverage', priceAverage.toString());

  priceCumulativeLast = priceCumulative;
  blockTimestampLast = reserves.blockTimestampLast;
}

app.get('/currentPrice', async (req, res) => {
  const message = utils.keccak256(
    utils.defaultAbiCoder.encode(
      ['uint256', 'uint256'],
      [priceAverage, blockTimestampLast]
    )
  );
  const sig = await wallet.signMessage(
    Buffer.from(message.substring(2), 'hex')
  );

  res.json({
    sig,
    blockTimestampLast: blockTimestampLast.toString(),
    priceAverage: priceAverage.toString(),
  });
});

app.listen(port, async () => {
  setInterval(updatePrice, 5 * SECOND);
  console.log(`App listening on port ${port}`);
});
