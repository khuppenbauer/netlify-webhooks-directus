exports.handler = async (event) => {
  if (event.httpMethod === 'POST') {
    console.log(event);
    return {
      statusCode: 200,
      body: 'Ok',
    };   
  }
  return {
    statusCode: 405,
    body: 'Method Not Allowed',
  };
};
