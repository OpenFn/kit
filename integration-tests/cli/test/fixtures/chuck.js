get('https://api.chucknorris.io/jokes/random');

fn((state) => ({ data: { value: state.data.value } }));
