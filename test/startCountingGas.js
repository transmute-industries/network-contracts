const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

let previousBlock;

const printTestGasUsage = () => {
  let testGasUsage = 0;
  const currentBlock = web3.eth.blockNumber;
  for (let block = previousBlock + 1; block <= currentBlock; block++) {
    let blockInformation = web3.eth.getBlock(block);
    blockInformation.transactions.forEach( (transactionHash) => {
      let transactionReceipt = web3.eth.getTransactionReceipt(transactionHash);
      testGasUsage += transactionReceipt.gasUsed;
    });
  }
  readline.moveCursor(rl, 1193, -1);
  console.log('(' + testGasUsage + ' gas used)');
  readline.clearLine(rl, 1);
};

beforeEach(() => {
  previousBlock = web3.eth.blockNumber;
});

afterEach(() => {
  printTestGasUsage();
});

after(() => {
  rl.close();
});
