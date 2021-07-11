import FileSystem from 'fs';
import * as tf from '@tensorflow/tfjs-node-gpu'

const csvTransform =
    ({xs, ys}) => {
      const values = [
        xs.playersCloseLeft,
        xs.playersCloseRight,
        xs.playersCloseTop,
        xs.playersCloseBottom,
        xs.playersLeft,
        xs.playersRight,
        xs.playersTop,
        xs.playersBottom,
        xs.platformCloseLeft,
        xs.platformCloseRight,
        xs.platformCloseTop,
        xs.platformCloseBottom
      ];
      return {xs: values, ys: ys.playerAction};
    }

class Trainer {
    model: tf.Sequential;

    constructor(){
        tf.loadLayersModel('file:///Code/HitboxBackend/src/ai/model/model.json').then(m => {
            this.model = m as tf.Sequential;
            this.model.compile({
                optimizer: tf.train.adam(),
                loss: 'sparseCategoricalCrossentropy',
                metrics: ['accuracy']
            });
            this.model.summary();
        });
        // this.model = tf.sequential();
        // this.model.add(tf.layers.dense({units: 250, activation: 'relu', inputShape: [12]}));
        // this.model.add(tf.layers.dense({units: 175, activation: 'relu'}));
        // this.model.add(tf.layers.dense({units: 150, activation: 'relu'}));
        // this.model.add(tf.layers.dense({units: 7, activation: 'softmax'}));
        // this.model.compile({
        //     optimizer: tf.train.adam(),
        //     loss: 'sparseCategoricalCrossentropy',
        //     metrics: ['accuracy']
        // });
    }

    async train(){
        var tfData = tf.data.csv('file:///Code/HitboxBackend/src/ai/data/data.csv', {columnConfigs: {playerAction: {isLabel: true}}})
            .map(csvTransform)
            .shuffle(10000)
            .batch(500);
        await this.model.fitDataset(tfData, {epochs: 1});
        var saveResult = await this.model.save('file:///Code/HitboxBackend/src/ai/model');
        console.log(saveResult);
    }

    getData(){
        tf
        var dirname = './src/ai/data';
        var data: any[] = [];
        FileSystem.readdir(dirname, function(err, filenames) {
            if (err) {
              return;
            }
            filenames.forEach(function(filename) {
                FileSystem.readFile(dirname + filename, 'utf-8', function(err, content) {
                if (err) {
                  return;
                }
                    data.push(JSON.parse(content));
                });
            });
        });
        return data;
    }
}

export default Trainer