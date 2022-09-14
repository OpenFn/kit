import { fn, each, combine } from '@openfn/language-common';
import { fetchTweets } from '@openfn/language-twitter';

// Writes an array to state as data.tweets.<userName>.tweets
fetchTweets(() => state.result.user);

// Sort all tweets into own tweets and RTs
each('$.data.tweets[*][*]',
  combine(
    fn(state => {
      console.log(state.data.text)
      return state;
    }),
    fn(state => {
      const { id, text } = state.data;
      if (text.startsWith("RT @")) {
        state.result.RTs.push(state.data.text)
      } else {
        state.result.ownTweets.push(state.data.text)
      }
      return state;
    }),
  )
) 
  
// tidy up & report
fn(state => {
  console.log(`Added ${state.result.ownTweets.length} own tweets`)
  console.log(`Added ${state.result.RTs.length} RTs`)
  
  return state.result;
})
