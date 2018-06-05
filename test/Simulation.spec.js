const data = require('./data');
const _ = require('lodash');
const { EventStore, StreamModel } = require('transmute-framework');
const eventStoreArtifact = require('../build/contracts/Warden.json');

contract('Simulation', accounts => {
  let workers = data.workers(accounts);
  let jobs = data.jobs(workers, data.functions);
  let store = new EventStore({
    eventStoreArtifact: eventStoreArtifact,
    web3Config: {
      providerUrl: 'http://localhost:8545'
    },
    ipfsConfig: {
      protocol: 'http',
      host: 'localhost',
      port: 5001
    },
    keenConfig: {}
  });

  before(async () => {
    await store.init();
  });

  it('jobs can be created', async () => {
    let job_recs = await Promise.all(
      jobs.map(async job => {
        return await store.write(
          accounts[0],
          {
            type: 'JOB_CREATED'
          },
          job
        );
      })
    );
  });

  const getAvailableJobs = async () => {
    const filter = event => {
      return (
        event.key.type === 'JOB_CREATED' || event.key.type === 'JOB_ASSIGNED'
      );
    };
    const reducer = (state, event) => {
      switch (event.key.type) {
        case 'JOB_CREATED': {
          return {
            ...state,
            [event.value.id]: event.value
          };
        }
        case 'JOB_ASSIGNED': {
          delete state[event.value.id];
          return state;
        }
      }
    };
    const simulation = new StreamModel(store, filter, reducer);
    await simulation.sync();
    return _.values(simulation.state.model);
  };

  const getIncompleteJobs = async () => {
    const filter = event => {
      return event.key.type === 'JOB_ASSIGNED';
    };
    const reducer = (state, event) => {
      switch (event.key.type) {
        case 'JOB_ASSIGNED': {
          return {
            ...state,
            [event.value.id]: event.value
          };
        }
      }
    };
    const simulation = new StreamModel(store, filter, reducer);
    await simulation.sync();
    return _.values(simulation.state.model);
  };

  const assignJobs = async () => {
    let jobs_by_employer_rep = _.sortBy(await getAvailableJobs(), job => {
      return job.employer.rep;
    });

    let workers_by_rep = _.sortBy(workers, worker => {
      return worker.rep;
    });

    while (jobs_by_employer_rep.length) {
      let highest_rep_job = jobs_by_employer_rep.pop();
      let highest_rep_worker = workers_by_rep.pop();

      await store.write(
        accounts[0],
        {
          type: 'JOB_ASSIGNED'
        },
        {
          ...highest_rep_job,
          employee: highest_rep_worker,
          status: 'in_progress'
        }
      );
    }
  };

  it('available jobs can be pulled as a stream', async () => {
    let available_jobs = await getAvailableJobs();
  });

  it('jobs can be assigned, and incomplete jobs can be pulled as a stream', async () => {
    await assignJobs();
    let incompleteJobs = await getIncompleteJobs();
    let availableJobs = await getAvailableJobs();
  });
});
