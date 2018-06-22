pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract TimeManager {
  using SafeMath for uint;

  uint public lastRound;
  uint public roundLength;

  constructor() {
    roundLength = 15;
  }

  function initializeRound() external {
    uint blockNumber = block.number;
    uint currentRound = blockNumber.div(roundLength);
    // lastRound == currentRound when two function calls happen within the same round.
    require(lastRound < currentRound);
    lastRound = currentRound;
  }
}
