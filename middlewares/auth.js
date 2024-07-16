const isLogin = async (req, res, next) => {
    try {
      if (req.session.user_id) {
        next();
      } else {
        res.redirect("/signin");
      }
    } catch (error) {
      console.log(error.message);
      res.redirect("/signin");
    }
};
  
const isLogout = async (req, res, next) => {
    try {
      if (req.session.user_id) {
        res.redirect("/shop");
      }
      next()
    } catch (error) {
      console.log(error.message);
    }
};
  
module.exports = {
    isLogin,
    isLogout,
};