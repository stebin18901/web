// src/components/BannerList.js
import React from "react";
import Slider from "react-slick";
import Banner from "./Banner";

const BannerList = ({ banners }) => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 700,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    arrows: true,
    pauseOnHover: true,
    adaptiveHeight: true,
  };

  return (
    <div className="banner-slider">
      <Slider {...settings}>
        {banners.map((banner, index) => (
          <Banner
            key={index}
            imageUrl={banner.imageUrl}
            title={banner.title}
            description={banner.description}
            buttonText={banner.buttonText}
            onButtonClick={banner.onButtonClick}
          />
        ))}
      </Slider>
    </div>
  );
};

export default BannerList;
