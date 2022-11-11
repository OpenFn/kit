// this is unit testable (although of course the describe-packaeg lookup is tricky)
import React from 'react';

const useDocs = () => {
  const test = [
    { name: 'fn', comment: 'a function '},
    { name: 'doTheThing', comment: 'another function '}
  ]

  return test;
};

export default useDocs;