const BlockMinerContract = artifacts.require("./BlockMiner.sol");

class BlockMiner {
  async init() {
    this.blockMiner = await BlockMinerContract.deployed();
  }

  async mine(numberOfBlocks) {
    for(let i = 0; i < numberOfBlocks; i++) {
      await this.blockMiner.mine();
    }
  }

  async mineUntilBeginningOfNextRound(roundLength) {
    const currentBlockNumber = web3.eth.blockNumber;
    const padding = roundLength - currentBlockNumber % roundLength - 1;
    await this.mine(padding);
  }
}

module.exports.blockMiner = new BlockMiner();

module.exports.assertFail = async (promise, message) => {
  try {
    await promise;
    assert(false);
  } catch(e) {
    if (e.name == 'AssertionError') {
      if (message)
        assert(false, message);
      else
        assert(false);
    }
  }
}
