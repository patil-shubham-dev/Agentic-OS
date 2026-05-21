console.log("Fetching root /");
fetch("http://localhost:3000/")
  .then(res => {
    console.log("Root / Response Status:", res.status);
    console.log("Root / Response Headers:", Object.fromEntries(res.headers.entries()));
    return res.text();
  })
  .then(text => {
    console.log("Root / Body length:", text.length);
    console.log("Root / Body snippet:", text.substring(0, 500));
    
    console.log("\nFetching /dashboard");
    return fetch("http://localhost:3000/dashboard");
  })
  .then(res => {
    console.log("Dashboard Status:", res.status);
    console.log("Dashboard Headers:", Object.fromEntries(res.headers.entries()));
    return res.text();
  })
  .then(text => {
    console.log("Dashboard Body length:", text.length);
    console.log("Dashboard Body snippet:", text.substring(0, 500));
  })
  .catch(err => {
    console.error("Error fetching:", err);
  });
