exports.handler = async (event) => {
  if (event.httpMethod === 'POST') {
    const data = JSON.parse(event.body || "{}");
    return { statusCode:200, body: JSON.stringify({ received:true, data })};
  }
  return { statusCode:400, body:"Only POST allowed" };
};