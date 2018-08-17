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
    mapping (address => uint) stakes;
    mapping (address => bool) isActive;
    // TODO: decrease total stake when not active or not available
    uint totalStake;
  }

  // Stores the ActiveProviderSet for each round
  mapping (uint => ActiveProviderSet) public activeProviderSets;

  modifier onlyBeforeActiveRoundIsLocked() {
    require(roundNumber > 0);
    require(block.number.sub(startOfCurrentRound) < electionPeriodLength.sub(rateLockDeadline));
    _;
  }

  function setElectionPeriodLength(uint _electionPeriodLength) public onlyOwner {
    emit ParameterChanged("electionPeriodLength", electionPeriodLength, _electionPeriodLength);
    electionPeriodLength = _electionPeriodLength;
  }

  function setRateLockDeadline(uint _rateLockDeadline) public onlyOwner {
    emit ParameterChanged("rateLockDeadline", rateLockDeadline, _rateLockDeadline);
    rateLockDeadline = _rateLockDeadline;
  }

  function setUnbondingPeriod(uint _unbondingPeriod) public onlyOwner {
    emit ParameterChanged("unbondingPeriod", unbondingPeriod, _unbondingPeriod);
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

    uint activeSetSize = Math.min256(numberOfActiveProviders, getProviderPoolSize());
    address currentProvider = getFirstProvider();
    ActiveProviderSet storage aps = activeProviderSets[roundNumber];
    for (uint i = 0; i < activeSetSize; i++) {
      aps.providers.push(currentProvider);
      aps.isActive[currentProvider] = true;

      uint stake = getProviderStake(currentProvider);
      // TODO: test
      aps.stakes[currentProvider] = stake;
      aps.totalStake = aps.totalStake.add(stake);

      // Set pending rates as current rates
      activeProviders[currentProvider] = registeredProviders[currentProvider];

      // Get next provider in the pool
      currentProvider = getNextProvider(currentProvider);
    }
  }

  function removeActiveProvider(address _provider) internal {
    ActiveProviderSet storage aps = activeProviderSets[roundNumber];
    require(aps.isActive[_provider]);
    // Remove from providers[];
    //   - Find index of _provider in providers array
    uint length = aps.providers.length;
    uint i = 0;
    while (aps.providers[i] != _provider) {
      i = i.add(1);
    }
    // Note: There is an opportunity to make the following process more efficient
    // by swapping the last provider in the array with the one we want to delete 
    // and then .pop(), however the array wouldn't be sorted by stake anymore

    //   - Shift all values from that index
    while (i < length.sub(1)) {
      aps.providers[i] = aps.providers[i.add(1)];
      i = i.add(1);
    }
    //   - Decrement length of array
    aps.providers.length = aps.providers.length.sub(1);
    // Set as inactive
    aps.isActive[_provider] = false;
    // Update totalStake
    uint stake = getProviderStake(_provider);
    // TODO: test
    delete aps.stakes[_provider];
    aps.totalStake = aps.totalStake.sub(stake);
    // Remove from activeProviders
    delete activeProviders[_provider];
  }

  // TODO: refactor all function relative to Active Provider set
  // into its own library

  // Getter functions for ActiveProviderSet
  function getActiveProviderAddresses() public view returns (address[]) {
    return activeProviderSets[roundNumber].providers;
  }

  function isProviderActive(address _provider) public view returns (bool) {
    return activeProviderSets[roundNumber].isActive[_provider];
  }

  function getActiveProviderStake(address _provider) public view returns (uint) {
    return activeProviderSets[roundNumber].stakes[_provider];
  }
}
