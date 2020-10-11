import { Provider } from 'react-redux';
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

import React from 'react';
import Game from './pages/game';
import Leaderboard from './pages/leaderboard';
import Instructions from './pages/instructions';
import Options from './components/options';
import Footer from './components/footer';
import { store } from './redux/store';

import './App.css';

class App extends React.Component {
  render() {
    return (
      <Provider store={store}>
        <Router>
          <Switch>
            <Route exact path="/">
              <Game/>
            </Route>
            <Route exact path="/leaderboard">
              <Leaderboard />
            </Route>
            <Route exact path="/instructions">
              <Instructions />
            </Route>
          </Switch>
          <Options/>
          <Footer/>
        </Router>
      </Provider>
    );
  }
}

export default App;
