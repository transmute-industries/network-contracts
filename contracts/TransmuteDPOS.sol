pragma solidity ^0.4.24;

import "./TransmuteToken.sol";
import "./RoundManager.sol";
import "./ProviderPool.sol";

contract TransmuteDPOS is TransmuteToken, RoundManager, ProviderPool {

  event DelegatorBonded(
    address indexed _delegator,
    address indexed _provider,
    uint _amount
  );

  event DelegatorUnbonded(
    address indexed _delegator,
    address indexed _provider,
    uint _amount
  );

  event ProviderAdded (
    address indexed _provider,
    uint _pricePerStorageMineral,
    uint _pricePerComputeMineral,
    uint _blockRewardCut,
    uint _feeShare
  );

  event ProviderUpdated (
    address indexed _provider,
    uint _pricePerStorageMineral,
    uint _pricePerComputeMineral,
    uint _blockRewardCut,
    uint _feeShare
  );

  event ProviderResigned (
    address indexed _provider
  );

  enum DelegatorStatus { Unbonded, UnbondedWithTokensToWithdraw, Bonded }

  struct Delegator {
    address delegateAddress;
    // TODO: rename variable
    uint amountBonded;
  }

  uint public numberOfDelegators;
  mapping(address => Delegator) public delegators;

  enum ProviderStatus { Unregistered, Registered }

  struct Provider {
    ProviderStatus status;
    uint pricePerStorageMineral;
    uint pricePerComputeMineral;
    uint blockRewardCut;
    uint feeShare;
    uint totalAmountBonded;
  }

  uint public numberOfProviders;
  mapping(address => Provider) public providers;

  struct WithdrawInformation {
    uint withdrawBlock;
    uint amount;
  }
  mapping (address => WithdrawInformation) public withdrawInformations;

  // FIXME: Those are temporary values
  constructor() public {
    // Set constants from RoundManager
    electionPeriodLength = 20;
    rateLockDeadline = 5;
    unbondingPeriod = 10;
  }

  function provider(uint _pricePerStorageMineral, uint _pricePerComputeMineral, uint _blockRewardCut, uint _feeShare)
    external onlyBeforeActiveRoundIsLocked
  {
    require(_blockRewardCut <= 100);
    require(_feeShare <= 100);
    Provider storage p = providers[msg.sender];
    Delegator storage d = delegators[msg.sender];
    require(d.delegateAddress == msg.sender);
    require(d.amountBonded > 0);
    if (p.status == ProviderStatus.Unregistered) {
      numberOfProviders = numberOfProviders.add(1);
      addProvider(msg.sender, p.totalAmountBonded);
      emit ProviderAdded(msg.sender, _pricePerStorageMineral, _pricePerComputeMineral, _blockRewardCut, _feeShare);
    } else {
      emit ProviderUpdated(msg.sender, _pricePerStorageMineral, _pricePerComputeMineral, _blockRewardCut, _feeShare);
    }
    p.status = ProviderStatus.Registered;
    p.pricePerStorageMineral = _pricePerStorageMineral;
    p.pricePerComputeMineral = _pricePerComputeMineral;
    p.blockRewardCut = _blockRewardCut;
    p.feeShare = _feeShare;
  }

  // TODO: change name
  function resignAsProvider(address _provider) internal {
    require(providers[_provider].status != ProviderStatus.Unregistered);
    removeProvider(_provider);
    delete providers[_provider];
    emit ProviderResigned(_provider);
  }

  function bond(address _provider, uint _amount) external {
    Provider storage p = providers[_provider];
    // A delegator is only allowed to bond to an Unregistered provider if the provider is himself
    // otherwise _provider has to be associated with a Registered provider
    require(_provider == msg.sender || p.status == ProviderStatus.Registered);
    // Check if delegator has not already bonded to some address
    require(delegators[msg.sender].delegateAddress == address(0));
    this.transferFrom(msg.sender, this, _amount);
    delegators[msg.sender] = Delegator(_provider, _amount);
    p.totalAmountBonded = p.totalAmountBonded.add(_amount);
    // Update the bonded amount of the provider in the pool
    if (p.status == ProviderStatus.Registered) {
      updateProvider(_provider, p.totalAmountBonded);
    }
    emit DelegatorBonded(msg.sender, _provider, _amount);
  }

  function unbond() external {
    // Only Bonded Delegators can call the function
    require(delegatorStatus(msg.sender) == DelegatorStatus.Bonded);
    Delegator storage d = delegators[msg.sender];
    Provider storage p = providers[d.delegateAddress];
    // Sets the block number from which the Delegator will be able to withdraw() his tokens
    uint withdrawBlock = block.number.add(unbondingPeriod);
    uint amount = d.amountBonded;
    withdrawInformations[msg.sender] = WithdrawInformation(withdrawBlock, amount);
    // Decrease the totalAmountBonded parameter of the provider
    p.totalAmountBonded = p.totalAmountBonded.sub(amount);
    if (d.delegateAddress == msg.sender) {
      // A Provider has to be a Delegator to himself
      // Therefore if a Provider unbonds he should resign
      resignAsProvider(msg.sender);
    } else {
      // Otherwise it should update the position of the Provider in the pool
      updateProvider(d.delegateAddress, p.totalAmountBonded);
    }
    emit DelegatorUnbonded(msg.sender, d.delegateAddress, amount);
    // Remove delegator from the list. He is now no longer in the the Bonded State
    delete delegators[msg.sender];
  }

  // TODO: Create the same function for Providers
  // This will remove the need for ProviderStatus inside the Provider Struct
  function delegatorStatus(address _delegator) public view returns (DelegatorStatus) {
    if (delegators[_delegator].amountBonded != 0) {
      // If _delegator is in the mapping, he is Bonded
      return DelegatorStatus.Bonded;
    } else if (withdrawInformations[_delegator].withdrawBlock != 0) {
      // Else if _delegator has some withdrawInformation, he just called unbond() and didn't withdraw() yet
      return DelegatorStatus.UnbondedWithTokensToWithdraw;
    } else {
      // Else he is Unbonded: either he didn't call bond() or he called bond() unbond() and withdraw()
      return DelegatorStatus.Unbonded;
    }
  }
}
