pragma solidity ^0.4.24;

import "./TransmuteToken.sol";
import "./RoundManager.sol";
import "./ProviderPool.sol";

contract TransmuteDPOS is TransmuteToken, RoundManager, ProviderPool {

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

  struct Delegator {
    address delegateAddress;
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
      updateProvider(msg.sender, p.totalAmountBonded);
      emit ProviderUpdated(msg.sender, _pricePerStorageMineral, _pricePerComputeMineral, _blockRewardCut, _feeShare);
    }
    p.status = ProviderStatus.Registered;
    p.pricePerStorageMineral = _pricePerStorageMineral;
    p.pricePerComputeMineral = _pricePerComputeMineral;
    p.blockRewardCut = _blockRewardCut;
    p.feeShare = _feeShare;
  }

  function resignAsProvider() public {
    require(providers[msg.sender].status != ProviderStatus.Unregistered);
    removeProvider(msg.sender);
    delete providers[msg.sender];
    emit ProviderResigned(msg.sender);
  }

  function bond(address _provider, uint _amount) external {
    Provider storage p = providers[_provider];
    // A delegator is only allowed to bond to an Unregistered provider if the provider is himself
    // otherwise _provider has to be associated with a Registered provider
    require(_provider == msg.sender || p.status != ProviderStatus.Unregistered);
    // Check if delegator has not already bonded to some address
    require(delegators[msg.sender].delegateAddress == address(0));
    this.transferFrom(msg.sender, this, _amount);
    delegators[msg.sender] = Delegator(_provider, _amount);
    p.totalAmountBonded = p.totalAmountBonded.add(_amount);
  }
}
