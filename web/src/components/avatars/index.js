
import React from 'react';
import styles from './styles.module.css';
import xmlToJSON from 'xmltojson';
import { Container, Row, Col } from 'react-bootstrap';
import Utils from '../../utils';

class Avatars extends React.Component {
  constructor(props){
    super(props);
    this.state = {};
  }

  componentDidMount(){
    fetch("https://hitbox.blob.core.windows.net/options?restype=container&comp=list", { mode: "cors" })
      .then(response => {
        response.text().then(xml => {
          var json = xmlToJSON.parseString(xml);
          var blobs = json.EnumerationResults[0].Blobs[0].Blob;
          var urls = [];
          blobs.forEach(blob => {
            urls.push({
              url: blob.Url[0]._text,
              title: Utils.getFilename(blob.Url[0]._text)
            });
          });
          this.setState({blobs: urls});
        });
      })
  }

  selectAvatar(option){
    this.props.onChange(option);
  }

  render() {
    return (
      <div className={styles.avatarContainer}>
        <Container>
          <Row xs={3}>
            { this.state.blobs ? this.state.blobs.map((blob, i) => {
              return <Col key={i}>
                  <img alt={`Avatar ${i + 1}`} onClick={() => this.selectAvatar(blob.url)} className={styles.avatar} src={blob.url} />
                </Col>
            }) : <Col></Col>}
          </Row>
        </Container>
      </div>
    );
  }
}

export default Avatars;