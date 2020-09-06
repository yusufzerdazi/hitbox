export default {
    uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & (0x3 | 0x8));
          return v.toString(16);
        });
    },

    millis(){
        var d = new Date();
        return d.getTime();
    },

    fillMixedText(ctx, args, x, y) {
        let defaultFillStyle = ctx.fillStyle;
        let defaultFont = ctx.font;
      
        ctx.save();
        args.forEach(({ text, fillStyle, font }) => {
          ctx.fillStyle = fillStyle || defaultFillStyle;
          ctx.font = font || defaultFont;
          ctx.fillText(text, x, y);
          x -= ctx.measureText(text).width;
        });
        ctx.restore();
    }
}
