pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./TransmuteDPOS.sol";

contract JobManager is TransmuteDPOS {
  using SafeMath for uint;

  enum MineralCategory { Compute, Storage }

  event MineralAdded (
    uint id,
    string name,
    address producer,
    MineralCategory category
  );

  event JobAdded (
    uint id,
    uint mineralId,
    uint maxPricePerMineral,
    uint expirationBlock,
    address consumerAddress,
    address electedProvider
  );

  struct Mineral {
    string name;
    address producer;
    MineralCategory category;
  }

  struct Job {
    uint mineralId;
    uint maxPricePerMineral;
    uint expirationBlock;
    address consumerAddress; // address of the Consumer who submitted the job
    address providerAddress; // address of the Provider who was elected to do the job
  }

  uint public numberOfMinerals;
  mapping(uint => Mineral) public minerals;

  uint public numberOfJobs;
  mapping(uint => Job) public jobs;

  function submitMineral(string _name, MineralCategory _mineralCategory) external {
    // name should be non null
    require(bytes(_name).length > 0);
    // Mineral has to be one of two categories: Compute or Storage
    require(_mineralCategory == MineralCategory.Compute || _mineralCategory == MineralCategory.Storage);
    minerals[numberOfMinerals] = Mineral(_name, msg.sender, _mineralCategory);
    emit MineralAdded(numberOfMinerals, _name, msg.sender, _mineralCategory);
    numberOfMinerals = numberOfMinerals.add(1);
  }

  function mineralIsValid(uint _mineralId) public view returns (bool) {
    Mineral memory m = minerals[_mineralId];
    return m.producer != address(0);
  }

  function submitJob(uint _mineralId, uint _maxPricePerMineral, uint _expirationBlock) external {
    // mineralId must correspond to an existing mineral
    require(mineralIsValid(_mineralId));
    // expirationBlock must be in the future
    require(_expirationBlock > block.number);

    address electedProvider = selectProvider(_maxPricePerMineral, minerals[_mineralId].category);
    Job storage j = jobs[numberOfJobs];
    j.mineralId = _mineralId;
    j.maxPricePerMineral = _maxPricePerMineral;
    j.expirationBlock = _expirationBlock;
    j.consumerAddress = msg.sender;
    j.providerAddress = electedProvider;
    emit JobAdded(numberOfJobs, _mineralId, _maxPricePerMineral, _expirationBlock, msg.sender, electedProvider);
    numberOfJobs = numberOfJobs.add(1);
  }

  // TODO: move into library
  function getPseudoRandomNumber() internal view returns (uint) {
    // Here we generate entropy by xoring together properties that
    // are hard / impossible to all manipulate at the same time
    // by a single actor

    // msg.sender can be manipulated for a user because he can
    // create new addresses very easily but it's impossible to
    // manipulate for a miner because he has no control over it
    bytes32 a = keccak256(abi.encode(msg.sender));
    // blockhash is hard to manipulate for a user because he will
    // have a short timeframe to send the transaction hoping it
    // gets mined in the very next block, but it is easy to manipulate
    // for a miner because they can wait for more blocks before adding
    // the transaction
    bytes32 b = keccak256(abi.encode(blockhash(block.number - 1)));
    // Note: we can add more entropy by xoring the keccak256 hashes
    // of local variables in the state of the contract
    return uint(a) ^ uint(b);
  }

  function selectProvider(uint _maxPricePerMineral, MineralCategory _mineralCategory) internal view returns (address) {
    // Select compatible providers from ActiveProviderSet
    ActiveProviderSet memory aps = activeProviderSets[roundNumber];
    uint numberOfCompatibleProviders = 0;
    uint compatibleProvidersTotalStake = 0;
    // addresses of active providers who are compatible with the price requirements
    address[] memory compatibleProviders = new address[](aps.providers.length);
    address p;
    for (uint i = 0; i < aps.providers.length; i++) {
      p = aps.providers[i];
      // If a Provider charges less than asked price in the right MineralCategory, add it in the array
      if (
        (_mineralCategory == MineralCategory.Compute && activeProviders[p].pricePerComputeMineral <= _maxPricePerMineral) ||
        (_mineralCategory == MineralCategory.Storage && activeProviders[p].pricePerStorageMineral <= _maxPricePerMineral)
      ) {
        compatibleProviders[numberOfCompatibleProviders] = p;
        numberOfCompatibleProviders = numberOfCompatibleProviders.add(1);
        compatibleProvidersTotalStake = compatibleProvidersTotalStake.add(getActiveProviderStake(p));
      }
    }

    uint randomSeed = getPseudoRandomNumber();
    if (numberOfCompatibleProviders == 0) {
      return address(0);
    } else {
      // Pseudorandomly pick a compatible Provider weighted by its stake
      // relative to the total stake of all compatible Providers
      uint r = randomSeed % compatibleProvidersTotalStake;
      uint s = 0;
      uint j = 0;

      while (s <= r && j < numberOfCompatibleProviders) {
        s = s.add(getActiveProviderStake(compatibleProviders[j]));
        j++;
      }

      return compatibleProviders[j - 1];
    }
  }
}
