module.exports.assertFail = async (promise, message) => {
  try {
    await promise;
    assert(false);
  } catch(e) {
    if (e.name == 'AssertionError') {
      assert(false, message);
    }
  }
}


