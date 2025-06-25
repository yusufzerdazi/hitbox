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

    fillMixedText(ctx, args, x, y, direction = -1) {
        let defaultFillStyle = ctx.fillStyle;
        let defaultFont = ctx.font;
      
        ctx.save();
        args.forEach(({ text, fillStyle, font }) => {
          ctx.fillStyle = fillStyle || defaultFillStyle;
          ctx.font = font || defaultFont;
          ctx.fillText(text, x, y);
          x += direction * ctx.measureText(text).width;
        });
        ctx.restore();
    },

    sortFunction(rowA, rowB, selector) {
      return (rowA[selector] || 0) - (rowB[selector] || 0);
    },

    getFilename(url) {
      if (url)
      {
          var m = url.toString().match(/.*\/(.+?)\./);
          if (m && m.length > 1)
          {
            return m[1];
          }
      }
      return "";
    },

    updateQueryStringParameter(uri, key, value) {
      var re = new RegExp("([?&])" + key + "=.*?(&|#|$)", "i");
      if (uri.match(re)) {
        return uri.replace(re, '$1' + key + "=" + value + '$2');
      } else {
        var hash =  '';
        if( uri.indexOf('#') !== -1 ){
            hash = uri.replace(/.*#/, '#');
            uri = uri.replace(/#.*/, '');
        }
        var separator = uri.indexOf('?') !== -1 ? "&" : "?";    
        return uri + separator + key + "=" + value + hash;
      }
    },

    /**
     * Draws a rounded rectangle using the current state of the canvas.
     * If you omit the last three params, it will draw a rectangle
     * outline with a 5 pixel border radius
     * @param {CanvasRenderingContext2D} ctx
     * @param {Number} x The top left x coordinate
     * @param {Number} y The top left y coordinate
     * @param {Number} width The width of the rectangle
     * @param {Number} height The height of the rectangle
     * @param {Number} [radius = 5] The corner radius; It can also be an object 
     *                 to specify different radii for corners
     * @param {Number} [radius.tl = 0] Top left
     * @param {Number} [radius.tr = 0] Top right
     * @param {Number} [radius.br = 0] Bottom right
     * @param {Number} [radius.bl = 0] Bottom left
     * @param {Boolean} [fill = false] Whether to fill the rectangle.
     * @param {Boolean} [stroke = true] Whether to stroke the rectangle.
     */
    roundRect(ctx, x, y, width, height, radius, fill, stroke) {
      if (typeof stroke === 'undefined') {
        stroke = true;
      }
      if (typeof radius === 'undefined') {
        radius = 5;
      }
      if (typeof radius === 'number') {
        radius = {tl: radius, tr: radius, br: radius, bl: radius};
      } else {
        var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
        for (var side in defaultRadius) {
          radius[side] = radius[side] || defaultRadius[side];
        }
      }
      ctx.beginPath();
      ctx.moveTo(x + radius.tl, y);
      ctx.lineTo(x + width - radius.tr, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
      ctx.lineTo(x + width, y + height - radius.br);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
      ctx.lineTo(x + radius.bl, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
      ctx.lineTo(x, y + radius.tl);
      ctx.quadraticCurveTo(x, y, x + radius.tl, y);
      ctx.closePath();
      if (fill) {
        ctx.fill();
      }
      if (stroke) {
        ctx.stroke();
      }
    },

    isMobile() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
             (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
    },

    isTablet() {
      return /(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(navigator.userAgent);
    },

    isTouchDevice() {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    },

    getDistance(touch1, touch2) {
      return Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
    },

    getCenter(touch1, touch2) {
      return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
    }
}
