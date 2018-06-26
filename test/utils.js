class BlockMiner {
  async mine(numberOfBlocks) {
    for(let i = 0; i < numberOfBlocks; i++) {
      await new Promise((resolve, _) => {
        web3.currentProvider.sendAsync({ method: "evm_mine", id: i }, resolve);
      });
    }
  }

  async mineUntilBeginningOfNextRound(roundManager) {
    const roundLength = await roundManager.roundLength.call();
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
