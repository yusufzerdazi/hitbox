
import React from 'react';
import { connect } from "react-redux";
import DataTable, { createTheme } from 'react-data-table-component';
import { store } from '../../redux/store';
import styles from './styles.module.css';
import Utils from '../../utils';

const mapStateToProps = state => {
  return {
    user: state.logIn.user
  }
};

createTheme('dark', {
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.7)',
    disabled: 'rgba(0,0,0,.12)',
  },
  background: {
    default: '#000000',
  },
  divider: {
    default: 'rgba(81, 81, 81, 1)',
  },
});

const columns = [
  {
    name: 'Name',
    selector: 'name',
    sortable: true
  },
  {
    name: 'Wins',
    selector: 'wins',
    sortable: true,
    right: true,
    sortFunction: (rowA, rowB) => Utils.sortFunction(rowA, rowB, 'wins')
  },
  {
    name: 'Kills',
    selector: 'kills',
    sortable: true,
    right: true,
    sortFunction: (rowA, rowB) => Utils.sortFunction(rowA, rowB, 'kills')
  },
  {
    name: 'Players beaten',
    selector: 'beaten',
    sortable: true,
    right: true,
    sortFunction: (rowA, rowB) => Utils.sortFunction(rowA, rowB, 'beaten')
  },
  {
    name: 'Losses',
    selector: 'losses',
    sortable: true,
    right: true,
    sortFunction: (rowA, rowB) => Utils.sortFunction(rowA, rowB, 'losses')
  },
  {
    name: 'Beaten/Losses',
    selector: 'killdeath',
    sortable: true,
    right: true,
    sortFunction: (rowA, rowB) => Utils.sortFunction(rowA, rowB, 'killdeath')
  },
  {
    name: 'Rank',
    selector: 'rank',
    sortable: true,
    right: true,
    sortFunction: (rowA, rowB) => Utils.sortFunction(rowA, rowB, 'rank')
  }
];

class Leaderboard extends React.Component {
  constructor(props){
    super(props);
    this.getLeaderboard = this.getLeaderboard.bind(this);
    this.loadLeaderboards = this.loadLeaderboards.bind(this);
    this.state = {consolidatedLeaderboards: {}};
  }

  convertLeaderboardsToArray(){
    var leaderboardsArray = [];
    for (var key in this.state.consolidatedLeaderboards) {
      var value = this.state.consolidatedLeaderboards[key];
      value.killdeath = value.losses && value.beaten ? Math.round((value.beaten / value.losses) * 100) / 100 : undefined;
      leaderboardsArray.push(value);
    }
    return leaderboardsArray
  }

  getLeaderboard(name, tranformation = (x) => x){
    return window.PlayFabClientSDK.GetLeaderboard({
      MaxResultsCount: 100,
      StatisticName: name
    }).then(l => {
        var consolidatedLeaderboards = this.state.consolidatedLeaderboards;
        l.data.Leaderboard.forEach(row => {
          if(!consolidatedLeaderboards[row.PlayFabId]){
            consolidatedLeaderboards[row.PlayFabId] = {};
          }
          consolidatedLeaderboards[row.PlayFabId]['name'] = row.DisplayName ? row.DisplayName : row.PlayFabId;
          consolidatedLeaderboards[row.PlayFabId][name] = tranformation(row.StatValue);
        })
        this.setState({consolidatedLeaderboards: consolidatedLeaderboards})
    });
  }

  loadLeaderboards(){
    var state = store.getState();
    if(state.logIn.user?.loggedIn){
      this.getLeaderboard('wins').then(() => {
        this.getLeaderboard('losses').then(() => {
          this.getLeaderboard('kills').then(() => {
            this.getLeaderboard('beaten').then(() => {
              this.getLeaderboard('rank').then(() => {
                this.setState({leaderboardsArray:this.convertLeaderboardsToArray()});
              })
            })
          })
        })
      });
    }
  }

  componentDidMount() {
    this.loadLeaderboards();
  }

  render() {
    return (
      <div className={styles.tableContainer} onClick={this.props.click}>
        {this.state.leaderboardsArray ? <DataTable
          theme="dark"
          noHeader={true}
          columns={columns}
          data={this.state.leaderboardsArray}
        /> : null}
      </div>
    );
  }
}

export default connect(mapStateToProps, () => ({}))(Leaderboard);