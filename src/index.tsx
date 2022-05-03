import React from "react";

interface Props {
  foo: string;
}

const App: React.FC<Props> = ({ foo }) => <div>Foo's value is like: {foo}</div>;

export default App;
