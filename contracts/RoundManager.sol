pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract RoundManager {
  using SafeMath for uint;

  // Round number of the last round
  uint public lastRound;
  // Block number of the start of the last round
  // N.B: not necessarily the block at which initializeRound() was called
  uint public startOfLastRound;

  uint public roundLength;
  uint public rateLockDealine;

  constructor() {
    roundLength = 20;
    rateLockDealine = 5;
  }

  function timeSinceBeginningOfLastRound() internal returns (uint) {
    return block.number.sub(startOfLastRound);
  }

  modifier onlyBeforeRoundLock() {
    require(timeSinceBeginningOfLastRound() < roundLength.sub(rateLockDealine));
    _;
  }

  modifier onlyDuringElectionPeriod() {
    require(timeSinceBeginningOfLastRound() < roundLength);
    require(timeSinceBeginningOfLastRound() >= roundLength.sub(rateLockDealine));
    _;
  }

  function initializeRound() external {
    uint blockNumber = block.number;
    uint currentRound = blockNumber.div(roundLength);
    // lastRound == currentRound when two function calls happen within the same round.
    require(lastRound < currentRound);
    lastRound = currentRound;
    startOfLastRound = lastRound.mul(roundLength);
  }
}
