pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract TimeManager is Ownable {
  using SafeMath for uint;

  uint public lastRound;
  uint public roundLength;

  constructor() {
    roundLength = 15;
  }

  function initializeRound() external {
    uint blockNumber = block.number;
    uint currentRound = blockNumber.div(roundLength);
    // lastRound == currentRound when two function call happen within the same round.
    require(lastRound < currentRound);
    lastRound = currentRound;
  }
}
