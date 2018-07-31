pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/Math.sol";
import "./ProviderPool.sol";
import "./ProviderManager.sol";

contract RoundManager is Ownable, ProviderPool, ProviderManager {
  using SafeMath for uint;

  // Round number of the last round
  uint public roundNumber;
  // Block number of the start of the last round
  uint public startOfCurrentRound;

  uint public electionPeriodLength;
  uint public rateLockDeadline;
  // The time (in number of blocks) that a Delegator has to wait before he can withdraw() his tokens
  uint public unbondingPeriod;

  // The set of active Providers for a given round
  struct ActiveProviderSet {
    address[] providers;
    mapping (address => bool) isActive;
    uint256 totalStake;
  }

  // Stores the ActiveProviderSet for each round
  mapping (uint => ActiveProviderSet) public activeProviderSets;

  modifier onlyBeforeActiveRoundIsLocked() {
    require(roundNumber > 0);
    require(block.number.sub(startOfCurrentRound) < electionPeriodLength.sub(rateLockDeadline));
    _;
  }

  function setElectionPeriodLength(uint _electionPeriodLength) public onlyOwner {
    electionPeriodLength = _electionPeriodLength;
  }

  function setRateLockDeadline(uint _rateLockDeadline) public onlyOwner {
    rateLockDeadline = _rateLockDeadline;
  }

  function setUnbondingPeriod(uint _unbondingPeriod) public onlyOwner {
    unbondingPeriod = _unbondingPeriod;
  }

  function initializeRound() external {
    require(block.number.sub(startOfCurrentRound) >= electionPeriodLength);
    roundNumber = roundNumber.add(1);
    startOfCurrentRound = block.number;
    setActiveProviders();
  }

  function setActiveProviders() internal {
    // Value must have been initialized
    require(numberOfActiveProviders > 0);

    uint totalStake = 0;
    uint activeSetSize = Math.min256(numberOfActiveProviders, providerPool.size);
    address currentProvider = providerPool.getFirst();
    ActiveProviderSet storage aps = activeProviderSets[roundNumber];
    for (uint i = 0; i < activeSetSize; i++) {
      aps.providers.push(currentProvider);
      // TODO: Optimization possible by removing this
      aps.isActive[currentProvider] = true;

      uint stake = providerPool.getKey(currentProvider);
      totalStake = totalStake.add(stake);

      // Set pending rates as current rates
      Provider storage p = providers[currentProvider];

      // Get next provider in the pool
      currentProvider = providerPool.getNext(currentProvider);
    }
    aps.totalStake = totalStake;
  }
}
