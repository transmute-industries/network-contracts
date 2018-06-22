pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract TimeManager is Ownable {
  using SafeMath for uint;

  uint public lastRound;
  uint public roundLength;
  uint public rateLockDeadline;

  constructor() {
    roundLength = 15;
    rateLockDeadline = 5;
  }

  function initializeRound() external {
    uint blockNumber = block.number;
    uint currentRound = blockNumber.div(roundLength);
    // lastRound == currentRound when two function call happen within the same round.
    require(lastRound < currentRound);
    lastRound = currentRound;
  }
}
