pragma solidity ^0.4.24;

contract DelegatorManager {
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

  enum DelegatorStatus { Unbonded, UnbondedWithTokensToWithdraw, Bonded }

  struct Delegator {
    address delegateAddress;
    // TODO: rename variable
    uint amountBonded;
  }

  uint public numberOfDelegators;
  mapping(address => Delegator) public delegators;

  struct WithdrawInformation {
    uint withdrawBlock;
    uint amount;
  }

  mapping (address => WithdrawInformation) public withdrawInformations;
}
