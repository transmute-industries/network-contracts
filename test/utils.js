class BlockMiner {
  async mine(numberOfBlocks) {
    for(let i = 0; i < numberOfBlocks; i++) {
      await new Promise((resolve, _) => {
        web3.currentProvider.sendAsync({ method: "evm_mine", id: i }, resolve);
      });
    }
  }

  async mineUntilBeginningOfNextRound(roundManager) {
    const electionPeriodLength = await roundManager.electionPeriodLength.call();
    const currentBlockNumber = web3.eth.blockNumber;
    const padding = electionPeriodLength - currentBlockNumber % electionPeriodLength - 1;
    await this.mine(padding);
  }

  async mineUntilLastBlockBeforeLockPeriod(roundManager) {
    const electionPeriodLength = await roundManager.electionPeriodLength.call();
    const rateLockDeadline = await roundManager.rateLockDeadline.call();
    const currentBlockNumber = web3.eth.blockNumber;
    const padding = electionPeriodLength - rateLockDeadline - 1 - currentBlockNumber % electionPeriodLength - 1;
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
