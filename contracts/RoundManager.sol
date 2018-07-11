pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract RoundManager {
  using SafeMath for uint;

  // Round number of the last round
  uint public roundNumber;
  // Block number of the start of the last round
  uint public startOfCurrentRound;

  uint public electionPeriodLength;
  uint public rateLockDeadline;

  modifier onlyBeforeActiveRoundIsLocked() {
    require(block.number.sub(startOfCurrentRound) < electionPeriodLength.sub(rateLockDeadline));
    _;
  }

  constructor() public {
    electionPeriodLength = 20;
    rateLockDeadline = 5;
  }

  function initializeRound() external {
    require(block.number.sub(startOfCurrentRound) >= electionPeriodLength);
    roundNumber = roundNumber.add(1);
    startOfCurrentRound = block.number;
  }
}
