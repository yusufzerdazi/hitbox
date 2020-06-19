import { Provider } from 'react-redux';
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

import React from 'react';
import Game from './pages/game';
import Leaderboard from './pages/leaderboard';
import Header from './components/header';
import Login from './components/login';
import { store } from './redux/store';

import './App.css';

class App extends React.Component {
  constructor(props){
    super(props);
  }

  render() {
    return (
      <Provider store={store}>
        <Router>
          <Header/>
          <Switch>
            <Route exact path="/">
              <Game/>
            </Route>
            <Route path="/leaderboard">
              <Leaderboard />
            </Route>
          </Switch>
          <Login afterSignIn={this.afterSignIn}/>
        </Router>
      </Provider>
    );
  }
}

export default App;
