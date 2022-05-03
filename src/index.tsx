import React from "react";
import './main.css';

interface Props {
  foo: string;
}

const App: React.FC<Props> = ({ foo }) => {
  return <h1 className="text-3xl font-bold underline">{foo}</h1>;
};

export default App;
