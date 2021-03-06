pragma solidity ^0.4.24;

import "./TransmuteToken.sol";
import "./RoundManager.sol";
import "./DelegatorManager.sol";

contract TransmuteDPOS is TransmuteToken, RoundManager, DelegatorManager {

  // FIXME: Those are temporary values
  constructor() public {
    // Set constants from RoundManager
    electionPeriodLength = 50;
    rateLockDeadline = 10;
    unbondingPeriod = 10;

    // Set constants from ProviderPool
    setProviderPoolMaxSize(5);
    setNumberOfActiveProviders(4);
  }

  function provider(uint _pricePerStorageMineral, uint _pricePerComputeMineral, uint _blockRewardCut, uint _feeShare)
    external onlyBeforeActiveRoundIsLocked
  {
    require(_blockRewardCut <= 100);
    require(_feeShare <= 100);

    Provider storage p = registeredProviders[msg.sender];
    p.pricePerStorageMineral = _pricePerStorageMineral;
    p.pricePerComputeMineral = _pricePerComputeMineral;
    p.blockRewardCut = _blockRewardCut;
    p.feeShare = _feeShare;

    Delegator storage d = delegators[msg.sender];
    // Provider has to be a Delegator to himself
    require(d.delegateAddress == msg.sender);
    if (providerStatus(msg.sender) == ProviderStatus.Unregistered) {
      numberOfProviders = numberOfProviders.add(1);
      addProvider(msg.sender, d.amountBonded);
      emit ProviderAdded(msg.sender, _pricePerStorageMineral, _pricePerComputeMineral, _blockRewardCut, _feeShare, d.amountBonded);
    } else {
      emit ProviderUpdated(msg.sender, _pricePerStorageMineral, _pricePerComputeMineral, _blockRewardCut, _feeShare, d.amountBonded);
    }
  }

  function bond(address _provider, uint _amount) external {
    // Only Unbonded Delegators can call this function
    require(delegatorStatus(msg.sender) == DelegatorStatus.Unbonded);
    // Transfer tokens from the Delegator's address to the contract's address
    require(_amount > 0);
    this.transferFrom(msg.sender, this, _amount);
    // Process bonding
    processBonding(_provider, _amount);
  }

  function unbond() external {
    // Only Bonded Delegators can call the function
    require(delegatorStatus(msg.sender) == DelegatorStatus.Bonded);

    Delegator storage d = delegators[msg.sender];
    // Sets the block number from which the Delegator will be able to withdraw() his tokens
    uint withdrawBlock = block.number.add(unbondingPeriod);
    uint amount = d.amountBonded;
    unbondingInformations[msg.sender] = UnbondingInformation(withdrawBlock, amount);
    if (d.delegateAddress == msg.sender) {
      if (providerIsRegistered(msg.sender)) {
        // A Provider has to be a Delegator to himself
        // Therefore if a Provider unbonds he should resign
        processResigning(msg.sender);
      }
    } else {
      // Otherwise it should update the position of the Provider in the pool
      uint currentProviderStake = getProviderStake(d.delegateAddress);
      uint newProviderStake = currentProviderStake.sub(amount);
      updateProvider(d.delegateAddress, newProviderStake);
    }
    emit DelegatorUnbonded(msg.sender, d.delegateAddress, amount);
    // Remove delegator from the list. He is now no longer in the the Bonded State
    delete delegators[msg.sender];
  }

  function resignAsProvider() external {
    require(providerIsRegistered(msg.sender));
    processResigning(msg.sender);
  }

  function processResigning(address _provider) internal {
    ProviderStatus ps = providerStatus(_provider);
    if (ps == ProviderStatus.RegisteredAndActive) {
      // Remove Provider from the active set
      removeActiveProvider(_provider);
    }
    // Remove Provider from providerPool
    removeProvider(_provider);
    // Remove Provider parameters
    delete registeredProviders[_provider];
    emit ProviderResigned(_provider);
  }

  function withdraw() external {
    UnbondingInformation storage unbondingInformation = unbondingInformations[msg.sender];
    require(unbondingInformation.withdrawBlock <= block.number);
    require(delegatorStatus(msg.sender) == DelegatorStatus.Unbonding);
    this.transfer(msg.sender, unbondingInformation.amount);
    delete unbondingInformations[msg.sender];
  }

  function rebond(address _provider) external {
    // Only Delegators who have called unbond() can call this function
    require(delegatorStatus(msg.sender) == DelegatorStatus.Unbonding);
    // Get amount previously bonded
    uint amount = unbondingInformations[msg.sender].amount;
    // Process bonding
    processBonding(_provider, amount);
    // Delete unbondingInformations of the Delegator
    delete unbondingInformations[msg.sender];
  }

  function processBonding(address _provider, uint _amount) internal {
    // A Delegator is only allowed to bond to himself or to a Registered Provider
    require(_provider == msg.sender || providerIsRegistered(_provider));
    // Create the Delegator in the mapping
    delegators[msg.sender] = Delegator(_provider, _amount);
    // Update the bonded amount of the Provider in the pool
    if (providerIsRegistered(_provider)) {
      uint currentProviderStake = getProviderStake(_provider);
      uint newProviderStake = currentProviderStake.add(_amount);
      updateProvider(_provider, newProviderStake);
    }
    emit DelegatorBonded(msg.sender, _provider, _amount);
  }

  function providerStatus(address _provider) public view returns (ProviderStatus) {
    if (this.containsProvider(_provider)) {
      if (activeProviderSets[roundNumber].isActive[_provider]) {
        return ProviderStatus.RegisteredAndActive;
      } else {
        return ProviderStatus.Registered;
      }
    } else {
      return ProviderStatus.Unregistered;
    }
  }

  function providerIsRegistered(address _provider) public view returns (bool) {
    ProviderStatus ps = providerStatus(_provider);
    return ( ps == ProviderStatus.Registered || ps == ProviderStatus.RegisteredAndActive);
  }

  function delegatorStatus(address _delegator) public view returns (DelegatorStatus) {
    if (delegators[_delegator].amountBonded != 0) {
      // If _delegator is in the mapping, he is Bonded
      return DelegatorStatus.Bonded;
    } else if (unbondingInformations[_delegator].withdrawBlock != 0) {
      // Else if _delegator has some unbondingInformation, he just called unbond() and didn't withdraw() or rebond() yet
      return DelegatorStatus.Unbonding;
    } else {
      // Else he is Unbonded: either he didn't call bond() or he called bond() unbond() and withdraw()
      return DelegatorStatus.Unbonded;
    }
  }
}
