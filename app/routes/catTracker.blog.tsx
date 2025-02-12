import { SetStateAction, useState } from "react";
import { Link , useLoaderData } from "@remix-run/react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

import { Navbar}  from "~/components/Navbar";
import Footer from "~/components/Footer";
import { Subarticle } from "~/components/Subarticle";
import Article from "~/components/Article";

import checoSetup from "~/images/checoSetup.png";
import checoWorking from "~/images/checoWorking.jpg";
import vestaboard from "~/images/vestaboard.png";
import inAction from "~/images/inAction.png";

export const loader = async () => {
  // You can fetch data here if needed
  return {
    // Return any data you want to use in the component
  };
};

export default function CatTrackerBlog() {
  const data = useLoaderData();
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = [
    { src: checoSetup, alt: "Checo Setup", caption: "Hardware setup for tracking Checo" },
    { src: checoWorking, alt: "Checo Working", caption: "Checo hard at work, seen from camera" },
    { src: inAction, alt: "Checo in Action", caption: "Checo in action" },
    { src: vestaboard, alt: "Checo's Work Log", caption: "Work time displayed on a Vestaboard" },
  ];

  const openLightbox = (index: SetStateAction<number>) => {
    setPhotoIndex(index);
    setOpen(true);
  };

  const PhotoComponent = ({ photo, index }) => (
    <div onClick={() => openLightbox(index)} style={{cursor: 'pointer', margin: '20px 0'}}>
      <img src={photo.src} alt={photo.alt} style={{maxWidth: '100%', height: 'auto'}} />
      <p style={{fontStyle: 'italic', marginTop: '10px'}}>{photo.caption}</p>
    </div>
  );

  return (
    <div className="bg-background bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article
          title="Cat Tracker"
          subtitle="Measuring Checo's Work Ethic"
        >
          <Subarticle subtitle="">
            <p>A familiar theme for me is having a fun idea and then later finding myself a bit too committed to the bit. That's what happened here with my cat, Checo.</p>
            
            <p>It all started with a simple curiosity: just how much does Checo work next to me? He seemed to always be there, clocking in hours by sleeping in his circle next to my desk. With a free weekend, I decided to turn this into a project to track his effort.</p>

            <PhotoComponent photo={photos[0]} index={0} />

            <p>To measure Checo's presence, I built a system using a Raspberry Pi W Zero 2 and a Raspberry Pi AI Camera. The software stack includes using DynamoDB, a custom trained ONNX AI Model, API Gateway, and Python in Lambda functions and on the RPi.</p>

            <PhotoComponent photo={photos[1]} index={1} />

            <p>The camera captures photos at ~40 second intervals, which are then processed to determine if there's a cat in the image via the custom AI model run on the edge. Based on the results it may add an entry to our database with details about which cat is in the image.</p>

            <p>When a user visits the website, we use API Gateway to hit a Lambda function to calculate the time worked and display that to the user.</p>

            <PhotoComponent photo={photos[2]} index={2} />

            <p>It's a fun way to keep my manager, the Checman, on task!</p>

            <PhotoComponent photo={photos[3]} index={3} />

            <p>See Checo's current status here: <Link to="/CatTracker">Checo Live</Link></p>
          </Subarticle>
        </Article>
      </main>
      <Footer />
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={photos}
        index={photoIndex}
      />
    </div>
  );
}